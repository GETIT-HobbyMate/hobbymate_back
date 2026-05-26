import pool from '../db.js'

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
    if(rows.length === 0) {
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
  const { authorId, title, content, meetingTime, maxCapacity, tags, openChatUrl, isFulled } = req.body;
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
// TODO: 인증토큰 확인 후 authorID가 posts 테이블에 들어가는 기능 구현
export const deletePost = async (req, res, next) => {
  const id = Number(req.params.id);
  try {
    const sql = `
    DELETE FROM posts WHERE id = ?
    `;

    // 인증토큰 구현 완료 시 작업할 예정
    // req.status(403)

    await pool.execute(sql, [id]);

    res.status(200).json({
      "success": true,
      "message": "게시물이 정상적으로 삭제되었습니다. ",
      "data": {}
    }); 
  } catch (err) {
    next(err);
  }
};