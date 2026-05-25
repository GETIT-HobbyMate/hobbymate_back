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
           IF(p.current_capacity >= p.max_capacity, true, false) AS isFulled,
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