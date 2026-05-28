import pool from '../db.js'

// =================================================================
// RECRUITMENT POSTS CRUD (모집 게시글 관리)
// Created by 황영종
// =================================================================

// 모집 게시글 리스트 조회
// TODO: 인증토큰 확인 절차 구현 필요
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
    FROM posts p
    LEFT JOIN post_tags t ON p.id = t.post_id
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
// TODO: 인증토큰 확인 절차 구현 필요
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
    FROM posts p
    LEFT JOIN post_tags t ON p.id = t.post_id
    WHERE p.id = ?
    GROUP BY p.id
    `;
    const [rows] = await pool.query(sql, [id]);


    // 게시글 불러오기 실패하였을 경우
    // 예외 처리: 존재하지 않는 게시글
    if (rows.length === 0) {
      return res.status(404).json({
        "success": false,
        "message": "존재하지 않거나 삭제된 게시글입니다.",
        "data": {
          "errorCode": "POST_NOT_FOUND"
        }
      });
    }



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
// TODO: 인증토큰 확인 후 req.user 등에서 authorId를 추출하도록 수정 필요
export const writePost = async (req, res, next) => {
  const authorId = req.user.id;
  const { title, content, meetingTime, maxCapacity, tags, openChatUrl, isFulled } = req.body;
  try {
    const sql_post = `
    INSERT INTO posts (author_id, title, content, meeting_time, max_capacity, open_chat_url, status, is_fulled)
    VALUES (?, ?, ?, ?, ?, ?, 'RECRUITING', ?)
    `;

    const [post_result] = await pool.execute(sql_post,
      [authorId, title, content, meetingTime, maxCapacity, openChatUrl, isFulled]
    );

    // auto_increment인 게시글 id
    const postId = post_result.insertId;

    if (tags && tags.length > 0) {
      const sql_tags = `
      INSERT INTO post_tags (post_id, tag_name)
      VALUES (?, ?)
      `;

      for (const tag of tags) {
        await pool.execute(sql_tags, [postId, tag]);
      }
    }

    res.status(201).json({
      "success": true,
      "message": "게시물이 등록되었습니다. ",
      "data": {
        "postId": postId
      }
    });
  } catch (err) {
    next(err);
  }
};


// 모집 게시글 삭제
export const deletePost = async (req, res, next) => {
  const id = Number(req.params.id);
  const userId = req.user.id;

  try {
    const [rows] = await pool.execute('SELECT author_id FROM posts WHERE id = ?', [id]);

    const sql = `
    DELETE FROM posts WHERE id = ?
    `;

    // 삭제 불가: 게시글 작성자가 아닌 경우
    if (rows[0].author_id !== userId) {
      return res.status(403).json({
        "success": true,
        "message": "게시글 작성자만 삭제할 수 있습니다.",
        "data": {
          "errorCode": "FORBIDDEN_USER"
        }
      });
    }

    await pool.execute(sql, [id]);

    res.status(200).json({
      "success": true,
      "message": "게시물이 정상적으로 삭제되었습니다.",
      "data": {}
    });

    // 401 Unauthorized는 authMiddleware에서 해결하였음
    // json 형식으로 출력이 안되고 있는데 해결 필요
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
  
    const check_sql = `
    SELECT current_capacity, max_capacity
    FROM posts WHERE id = ? FOR UPDATE
    `;

    const [rows] = await conn.execute(check_sql, [id]);
    const post = rows[0];

    
    // 신청 불가: 정원이 다 찼을 경우
    if (post.current_capacity >= post.max_capacity) {
      await conn.rollback(); // 중간에 나갈 때 롤백
      return res.status(409).json({
        "success": false,
        "message": "이미 정원이 마감된 모임입니다.",
        "data": {
          "errorCode": "CAPACITY_FULL"
        }
      });
    }
    

    const apply_sql = `
      INSERT INTO applications (post_id, applicant_id)
      VALUES (?, ?)
      `;

    await conn.execute(apply_sql, [id, applicantId]);

    // 게시글 신청 인원 수 변경
    const post_update_sql = `
      UPDATE posts
      SET current_capacity = current_capacity + 1, status = ?
      WHERE id = ?
      `;

    // 신청가능 정원 한 명 남았을 경우
    const status = (post.max_capacity - post.current_capacity === 1) ? 'COMPLETED' : 'RECRUITING';

    
    await conn.execute(post_update_sql, [status, id]);

    // 모든 쿼리가 에러 없이 성공했다면 최종적으로 DB에 반영
    await conn.commit();


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
// TODO: 유저 id 있어야 함, 인증토큰 확인 절차 구현 필요, 방장은 취소 못하게 해야함
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
    FROM posts WHERE id = ? FOR UPDATE
    `;

    const [rows] = await conn.execute(check_sql, [id]);
    const post = rows[0];


    // 취소 불가: 매칭이 완료된 모임의 경우
    if (post.status == 'COMPLETED') {
      await conn.rollback();

      return res.status(400).json({
        "success": false,
        "message": "이미 매칭이 완료된 모임은 취소할 수 없습니다.",
        "data": {
          "errorCode": "ALREADY_COMPLETED"
        }
      });
    }

    // 취소 불가: 방장의 경우
    if(applicantId === post.author_id)
      return res.status(400).json({
        "success": false,
        "message": "방장은 매칭을 취소할 수 없습니다.",
        "data": {
          "errorCode": "LEADER_CANNOT_CANCEL_MATCH"
        }
      });
    
    const apply_sql = `
      UPDATE applications
      SET status = 'CANCELED'
      WHERE post_id = ? AND applicant_id = ?
      `;

    await conn.execute(apply_sql, [id, applicantId]);

    // 게시글 신청 인원 수 변경
    const post_update_sql = `
      UPDATE posts
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