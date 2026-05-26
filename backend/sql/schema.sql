CREATE TABLE Users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL COMMENT '학번',
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE Table Posts (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  author_id bigint NOT NULL COMMENT '방장 유저 ID',
  title varchar(255) NOT NULL,
  content text NOT NULL,
  meeting_time timestamp NOT NULL COMMENT '모임 예정 일시',
  current_capacity int DEFAULT 1 NOT NULL COMMENT '현재 확정 인원 (방장 포함)',
  max_capacity int NOT NULL COMMENT '최대 모집 인원',
  open_chat_url varchar(255) NOT NULL COMMENT '카카오톡 오픈채팅 링크',
  status varchar(20) default 'RECRUITING' COMMENT '상태 (RECRUITING / COMPLETED)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_fulled BOOLEAN DEFAULT FALSE COMMENT '꼭 인원이 차야 진행하는지 여부(true: 꽉 차야지 진행되는 게시물)',
  
  -- Relation: 유저(1) : 게시글(N)
  FOREIGN KEY (author_id) REFERENCES Users(id)
);

CREATE Table Post_Tags (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  post_id bigint NOT NULL,
  tag_name varchar(50) NOT NULL COMMENT '#북문, #마라탕 등',
  
  -- Relation: 게시글(1) : 태그(N)
  -- 게시글 삭제 시 모든 태그들이 삭제되어야 하므로 CASCADE
  FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE
);


CREATE Table Applications (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  post_id bigint NOT NULL,
  applicant_id bigint NOT NULL COMMENT '신청자 유저 ID',
  status varchar(20) default 'APPLIED' COMMENT '상태 (APPLIED / CANCELED)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  
  -- Relation: 유저(1) : 매칭신청(N)
  FOREIGN KEY (applicant_id) REFERENCES Users(id),
  
  -- Relation: 게시글(1) : 매칭신청(N)
  -- 게시글이 작성되면 Application도 자동 삭제 처리
  FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE
);

CREATE Table Notifications (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  user_id bigint NOT NULL COMMENT '알림 받을 유저 ID',
  post_id bigint NOT NULL COMMENT '관련 게시글 ID',
  type varchar(50) NOT NULL COMMENT '알림 종류 (예: MATCH_COMPLETE)',
  message text NOT NULL,
  open_chat_url varchar(255) COMMENT '카카오톡 오픈채팅 링크',
  is_read boolean default false COMMENT 'true: 이미 읽은 내용',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Relation: 유저(1) : 알림(N)
  FOREIGN KEY (user_id) REFERENCES Users(id),
  
  -- Relation: 게시글(1) : 알림(N)
  -- 게시글이 삭제된다면 연결된 자식 테이블(Notifications)도 삭제되어야 함
  FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE
);
