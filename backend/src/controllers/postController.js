import pool from '../db.js'
import { HttpError } from '../errors/httpError.js';
import { sendMatchCompleteNotification } from './notificationController.js';

// =================================================================
// RECRUITMENT POSTS CRUD & SEARCH (모집 게시글 관리 및 검색)
// Created by 황영종
// =================================================================

// 모집 게시글 리스트 조회
export const getAllPosts = async (req, res, next) => {
  try {
    // gemini 피셜 group_concat이 태그들을 하나의 문자열로 묶어준다고 하는데..
    const sql = `
    SELECT p.id AS postId,
           p.title AS title,
           p.current_capacity AS currentCapacity,
           p.max_capacity AS maxCapacity,
           p.meeting_time AS meetingTime,
           p.is_fulled AS isFulled,
           GROUP_CONCAT(t.tag_name) AS tags
    FROM Posts p
    LEFT JOIN Post_Tags t ON p.id = t.post_id
    GROUP BY p.id
    `;
    const [rows] = await pool.query(sql);


    // formattedPosts: 출력 형식 조정
    const formattedPosts = rows.map(row => ({
      ...row,
      isFulled: Boolean(row.isFulled),
      tags: row.tags ? row.tags.split(',') : []
    }));



    res.status(200).json({
      "success": true,
      "message": "게시글 목록을 불러왔습니다.",
      "data": {
        "posts": formattedPosts
      }
    });
  } catch (err) {
    next(err);
  }
};



// 모집 게시글 상세 조회
export const getPostById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const sql = `
    SELECT p.id AS postId,
           p.author_id AS author,
           p.title AS title,
           p.content AS content,
           p.current_capacity AS currentCapacity,
           p.max_capacity AS maxCapacity,
           p.meeting_time AS meetingTime,
           p.is_fulled AS isFulled,
           GROUP_CONCAT(t.tag_name) AS tags
    FROM Posts p
    LEFT JOIN Post_Tags t ON p.id = t.post_id
    WHERE p.id = ?
    GROUP BY p.id
    `;
    const [rows] = await pool.query(sql, [id]);


    // 게시글 불러오기 실패하였을 경우
    // 예외 처리: 존재하지 않는 게시글
    if (rows.length === 0)
      return next(new HttpError(404, "존재하지 않거나 삭제된 게시글입니다.", "POST_NOT_FOUND"));



    // 게시글 불러오기 성공하였을 경우
    // formattedPosts: 출력 형식 조정
    const row = rows[0];
    const formattedPost = {
      ...row,
      isFulled: Boolean(row.isFulled),
      tags: row.tags ? row.tags.split(',') : []
    };



    res.status(200).json({
      "success": true,
      "message": "게시글을 불러왔습니다.",
      "data": {
        "posts": formattedPost
      }
    });
  } catch (err) {
    next(err);
  }
};




// 모집 게시글 작성
export const writePost = async (req, res, next) => {
  const authorId = req.user.id;
  const { title, content, meetingTime, maxCapacity, tags, openChatUrl, isFulled } = req.body;
  
  // 트랜잭션 전용 커넥션 생성 (태그 실패 시 게시글도 롤백되도록 트랜잭션 추가)
  const conn = await pool.getConnection();
  try {
    // 트랜잭션 시작
    await conn.beginTransaction();

    const sql_post = `
    INSERT INTO Posts (author_id, title, content, meeting_time, max_capacity, open_chat_url, status, is_fulled)
    VALUES (?, ?, ?, ?, ?, ?, 'RECRUITING', ?)
    `;

    const [post_result] = await conn.execute(sql_post,
      [authorId, title, content, meetingTime, maxCapacity, openChatUrl, isFulled]
    );

    // auto_increment인 게시글 id
    const postId = post_result.insertId;

    if (tags && tags.length > 0) {
      const sql_tags = `
      INSERT INTO Post_Tags (post_id, tag_name)
      VALUES (?, ?)
      `;

      for (const tag of tags) {
        await conn.execute(sql_tags, [postId, tag]);
      }
    }

    // 모든 쿼리가 성공하면 최종 DB 반영
    await conn.commit();

    // 예외 처리: 만약 방장이 최대 모집 인원을 1명으로 설정했다면 개설과 동시에 자동 마감 처리 및 알림 발송
    if (Number(maxCapacity) === 1) {
      await sendMatchCompleteNotification(postId);
    }

    res.status(201).json({
      "success": true,
      "message": "게시물 등록되었습니다. ",
      "data": {
        "postId": postId
      }
    });
  } catch (err) {
    // 실패 시 롤백
    await conn.rollback();
    next(err);
  } finally {
    // 커넥션 반환
    conn.release();
  }
};


// 모집 게시글 삭제
export const deletePost = async (req, res, next) => {
  const id = Number(req.params.id);
  const userId = req.user.id;

  try {
    const [rows] = await pool.execute('SELECT author_id FROM Posts WHERE id = ?', [id]);

    // 예외 처리: 존재하지 않는 게시글일 경우
    if (rows.length === 0) {
      return next(new HttpError(404, "존재하지 않거나 삭제된 게시글입니다.", "POST_NOT_FOUND"));
    }

    const sql = `
    DELETE FROM Posts WHERE id = ?
    `;

    // 삭제 불가: 게시글 작성자가 아닌 경우
    if (rows[0].author_id !== userId)
      return next(new HttpError(403, "게시글 작성자만 삭제할 수 있습니다.", "FORBIDDEN_USER"));

    await pool.execute(sql, [id]);

    res.status(200).json({
      "success": true,
      "message": "게시물이 정상적으로 삭제되었습니다.",
      "data": {}
    });

  } catch (err) {
    next(err);
  }
};



// 태그 기반 게시물 검색
export const searchPostsByTag = async (req, res, next) => {
  const { tag } = req.query;

  if (!tag) {
    return next(new HttpError(400, "검색할 태그를 입력해주세요.", "TAG_REQUIRED"));
  }

  try {
    const sql = `
    SELECT p.id AS postId,
           p.title AS title,
           p.current_capacity AS currentCapacity,
           p.max_capacity AS maxCapacity,
           p.meeting_time AS meetingTime,
           p.is_fulled AS isFulled,
           GROUP_CONCAT(t.tag_name) AS tags
    FROM Posts p
    LEFT JOIN Post_Tags t ON p.id = t.post_id
    WHERE p.id IN (SELECT post_id FROM Post_Tags WHERE tag_name = ?)
        AND status = 'RECRUITING'
    GROUP BY p.id
    ORDER BY created_at
    `;
    const [rows] = await pool.query(sql, [tag]);

    const formattedPosts = rows.map(row => ({
      ...row,
      isFulled: Boolean(row.isFulled),
      tags: row.tags ? row.tags.split(',') : []
    }));

    res.status(200).json({
      "success": true,
      "message": "게시물 검색 결과를 불러왔습니다.",
      "data": {
        "posts": formattedPosts
      }
    });
  } catch (err) {
    next(err);
  }
};





// =================================================================
// MATCHING & APPLICATIONS (매칭 신청 및 취소)
// Created by 황영종
// =================================================================

// 매칭 신청
export const applyMatch = async (req, res, next) => {
  const id = Number(req.params.id);
  const applicantId = req.user.id;

  // 트랜잭션 전용 커넥션 생성
  const conn = await pool.getConnection();

  try {
    // 트랜잭션 시작 알림
    await conn.beginTransaction();
  
    // 예외 처리: 방장 셀프 신청 제한을 식별하기 위해 author_id 컬럼 추가 조회
    const check_sql = `
    SELECT current_capacity, max_capacity, author_id
    FROM Posts WHERE id = ? FOR UPDATE
    `;

    const [rows] = await conn.execute(check_sql, [id]);
    const post = rows[0];

    // 예외 처리: 존재하지 않는 게시글일 경우
    if (!post) {
      await conn.rollback();
      return next(new HttpError(404, "존재하지 않거나 삭제된 게시글입니다.", "POST_NOT_FOUND"));
    }

    // 예외 처리: 방장 본인이 자신의 모임에 신청하려 할 때 차단
    if (post.author_id === applicantId) {
      await conn.rollback();
      return next(new HttpError(400, "방장은 본인의 모임에 신청할 수 없습니다.", "LEADER_CANNOT_APPLY"));
    }

    // 예외 처리: 이미 신청 상태('APPLIED')인 유저가 또 중복 신청하는 것 방지
    const [existingApp] = await conn.execute(
      `SELECT id FROM Applications WHERE post_id = ? AND applicant_id = ? AND status = 'APPLIED'`,
      [id, applicantId]
    );
    if (existingApp.length > 0) {
      await conn.rollback();
      return next(new HttpError(409, "이미 신청을 완료한 모임입니다.", "ALREADY_APPLIED"));
    }

    // 신청 불가: 정원이 다 찼을 경우
    if (post.current_capacity >= post.max_capacity) {
      await conn.rollback(); // 중간에 나갈 때 롤백
      return next(new HttpError(409, "이미 정원이 마감된 모임입니다.", "CAPACITY_FULL"));
    }

    const apply_sql = `
      INSERT INTO Applications (post_id, applicant_id)
      VALUES (?, ?)
      `;

    await conn.execute(apply_sql, [id, applicantId]);

    // 게시글 신청 인원 수 변경 (마감 상태값 변경 책임은 알림 발송 함수에 넘기므로 인원수만 증가시킵니다)
    const post_update_sql = `
      UPDATE Posts
      SET current_capacity = current_capacity + 1
      WHERE id = ?
      `;

    await conn.execute(post_update_sql, [id]);

    // 모든 쿼리가 에러 없이 성공했다면 최종적으로 DB에 반영
    await conn.commit();

    // 모든 DB 반영(커밋) 직후, 이번 신청으로 인해 인원이 가득 찼다면 매칭 완료 알림 발송 및 게시글 마감 로직 실행
    if (post.current_capacity + 1 === post.max_capacity) {
      await sendMatchCompleteNotification(id);
    }

    res.status(200).json({
      "success": true,
      "message": "매칭 신청이 완료되었습니다.",
      "data": {}
    });
  } catch (err) {
    // 중간에 쿼리 하나라도 실패해서 catch로 오면 전부 롤백
    await conn.rollback();
    next(err);
  } finally {
    // 작업이 끝나면 빌려온 커넥션을 반드시 반환
    conn.release();
  }
};



// 매칭 신청 취소(참여자용)
export const cancelApply = async (req, res, next) => {
  const id = Number(req.params.id);
  const applicantId = req.user.id;

  // 트랜잭션 전용 커넥션 생성
  const conn = await pool.getConnection();

  try {
    // 트랜잭션 시작 알림
    await conn.beginTransaction();

    const check_sql = `
    SELECT current_capacity, status, author_id
    FROM Posts WHERE id = ? FOR UPDATE
    `;

    const [rows] = await conn.execute(check_sql, [id]);
    const post = rows[0];

    // 예외 처리: 존재하지 않는 게시글일 경우
    if (!post) {
      await conn.rollback();
      return next(new HttpError(404, "존재하지 않거나 삭제된 게시글입니다.", "POST_NOT_FOUND"));
    }

    // 취소 불가: 매칭이 완료된 모임의 경우
    if (post.status == 'COMPLETED') {
      await conn.rollback();
      return next(new HttpError(400, "이미 매칭이 완료된 모임은 취소할 수 없습니다.", "ALREADY_COMPLETED"));
    }

    // 취소 불가: 방장의 경우
    if(applicantId === post.author_id) {
      await conn.rollback();
      return next(new HttpError(400, "방장은 매칭을 취소할 수 없습니다.", "LEADER_CANNOT_CANCEL_MATCH"));
    }
    
    // 예외 처리: 현재 참여 신청('APPLIED') 중인 대상에 대해서만 취소를 적용할 수 있도록 조건 추가
    const apply_sql = `
      UPDATE Applications
      SET status = 'CANCELED'
      WHERE post_id = ? AND applicant_id = ? AND status = 'APPLIED'
      `;

    const [applyResult] = await conn.execute(apply_sql, [id, applicantId]);

    // 예외 처리: 실제로 영향 받은 행(affectedRows)이 0개라면 허위 요청이거나 이미 취소된 것이므로 인원 차감을 방지합니다
    if (applyResult.affectedRows === 0) {
      await conn.rollback();
      return next(new HttpError(400, "취소할 수 있는 신청 내역이 존재하지 않습니다.", "APPLICATION_NOT_FOUND"));
    }

    // 게시글 신청 인원 수 변경
    const post_update_sql = `
      UPDATE Posts
      SET current_capacity = current_capacity - 1
      WHERE id = ?
      `;    
    await conn.execute(post_update_sql, [id]);


    // 모든 쿼리가 성공하면 최종 DB 반영
    await conn.commit();
    
    res.status(200).json({
      "success": true,
      "message": "매칭 신청이 취소되었습니다.",
      "data": {}
    });
  } catch (err) {
    // 실패 시 전체 롤백
    await conn.rollback();
    next(err);
  } finally {
    // 작업 완료 후 커넥션 반환
    conn.release();
  }
};