import pool from './database.js'

// 데이터베이스 초기화 스크립트
const initDatabase = async () => {
  try {
    // 회원 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) UNIQUE,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        member_type VARCHAR(50) NOT NULL,
        name VARCHAR(100),
        business_name VARCHAR(200),
        representative_name VARCHAR(100),
        business_number VARCHAR(50),
        industry VARCHAR(100),
        business_type VARCHAR(100),
        base_address TEXT,
        detail_address TEXT,
        start_date DATE,
        gender VARCHAR(10),
        resident_number VARCHAR(50),
        signup_method VARCHAR(50) DEFAULT '회원 직접 가입',
        has_info_input BOOLEAN DEFAULT false,
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 비밀번호 컬럼 추가 (기존 테이블 호환)
    await pool.query(`
      ALTER TABLE members
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
    `)

    // 기존 address 컬럼이 있으면 base_address와 detail_address로 마이그레이션
    await pool.query(`
      DO $$
      BEGIN
        -- address 컬럼이 있고 base_address가 없으면 마이그레이션
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'address')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'members' AND column_name = 'base_address') THEN
          ALTER TABLE members ADD COLUMN base_address TEXT;
          ALTER TABLE members ADD COLUMN detail_address TEXT;
          -- 기존 address 값을 base_address로 이동
          UPDATE members SET base_address = address WHERE address IS NOT NULL;
          ALTER TABLE members DROP COLUMN IF EXISTS address;
        END IF;
      END $$;
    `)

    // 기존 데이터에 customer_id가 없으면 추가 (마이그레이션 스크립트에서 처리)
    // initDatabase에서는 테이블 생성만 수행

    // 회원 유형 테이블 (한 회원이 여러 유형을 가질 수 있음)
    // - 한 휴대폰 번호(=members 한 행)가 비사업자 / 개인 사업자 / 법인 사업자 중
    //   여러 유형을 동시에 가질 수 있어요.
    // - 관리자 페이지 "고객관리" 표는 유형별로 행을 분리해서 보여주므로,
    //   유형마다 별도의 customer_id 가 필요합니다. (예: 01yyMMdd001a, 02yyMMdd003c)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_types (
        id SERIAL PRIMARY KEY,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        member_type VARCHAR(50) NOT NULL,
        customer_id VARCHAR(50),
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // 이미 운영 중인 DB에는 customer_id 컬럼이 없을 수 있으므로 안전하게 추가
    // 한 회원이 여러 유형을 가입한 경우, "유형별로 다른 정보" 가 그대로 보존되도록
    // 사업자/비사업자 정보를 member_types 행에 함께 저장합니다.
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS name VARCHAR(100)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS resident_number VARCHAR(20)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS business_name VARCHAR(200)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS representative_name VARCHAR(100)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS business_number VARCHAR(50)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS industry VARCHAR(100)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS business_type VARCHAR(100)`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS base_address TEXT`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS detail_address TEXT`)
    await pool.query(`ALTER TABLE member_types ADD COLUMN IF NOT EXISTS start_date DATE`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_types_member_id ON member_types(member_id)`)
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_member_types_member_type
                       ON member_types(member_id, member_type)`)

    // 기존 데이터 보정 — member_types 행에 customer_id 가 비어 있다면
    // 해당 회원의 members.customer_id 와 동일한 값을 채워서 표가 비어 보이지 않도록 합니다.
    await pool.query(`
      UPDATE member_types mt
         SET customer_id = m.customer_id
        FROM members m
       WHERE mt.member_id = m.id
         AND mt.customer_id IS NULL
         AND m.customer_id IS NOT NULL
    `)

    // 기존 데이터: 비사업자 행에는 members.name/gender/resident_number, 그 외 유형
    // 행에는 사업자 정보(business_name 등)을 채워 둡니다.
    // 같은 회원이 여러 type 인 경우, 비사업자가 아닌 행 사이에는 정보가 똑같이
    // 채워질 수 있어요. 신규 가입부터는 type 별로 정확하게 분리되어 저장됩니다.
    await pool.query(`
      UPDATE member_types mt
         SET name = COALESCE(mt.name, m.name),
             gender = COALESCE(mt.gender, m.gender),
             resident_number = COALESCE(mt.resident_number, m.resident_number),
             business_name = COALESCE(mt.business_name, m.business_name),
             representative_name = COALESCE(mt.representative_name, m.representative_name),
             business_number = COALESCE(mt.business_number, m.business_number),
             industry = COALESCE(mt.industry, m.industry),
             business_type = COALESCE(mt.business_type, m.business_type),
             base_address = COALESCE(mt.base_address, m.base_address),
             detail_address = COALESCE(mt.detail_address, m.detail_address),
             start_date = COALESCE(mt.start_date, m.start_date)
        FROM members m
       WHERE mt.member_id = m.id
    `)

    // 상품 카테고리 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        brief_description TEXT,
        detailed_description TEXT,
        display_status VARCHAR(20) DEFAULT '비진열',
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 상품 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES product_categories(id),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        price INTEGER NOT NULL,
        description TEXT,
        required_documents TEXT,
        available_for_non_business BOOLEAN DEFAULT false,
        available_for_individual_business BOOLEAN DEFAULT false,
        available_for_corporate_business BOOLEAN DEFAULT false,
        display_status VARCHAR(20) DEFAULT '비진열',
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // required_documents 컬럼 추가 (기존 테이블에 없을 경우)
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS required_documents TEXT
    `)

    // payment_description 컬럼 추가 (결제 페이지에 출력되는 상품 설명)
    //  - "상품 설명" 과는 별개로, 결제 페이지 전용 안내/결제·환불 안내 등을 저장합니다.
    //  - 기존 상품 데이터에는 비어 있을 수 있으므로 NULL 허용.
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS payment_description TEXT
    `)

    // 주문 테이블 (PRD에 맞게 수정)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(50) UNIQUE NOT NULL,
        member_id INTEGER REFERENCES members(id),
        product_id INTEGER REFERENCES products(id),
        category_name VARCHAR(200),
        product_name VARCHAR(200),
        product_price INTEGER,
        required_documents TEXT,
        status VARCHAR(50) DEFAULT '결제대기',
        payment_date TIMESTAMP,
        cancel_amount INTEGER DEFAULT 0,
        cancel_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 서류 카테고리 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 서류 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES document_categories(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        usage_status VARCHAR(20) DEFAULT '비진열',
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 회원 서류 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_documents (
        id SERIAL PRIMARY KEY,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id),
        document_id INTEGER REFERENCES documents(id),
        file_path VARCHAR(500) NOT NULL,
        file_name VARCHAR(200) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted BOOLEAN DEFAULT false
      )
    `)

    // 메모 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS memos (
        id SERIAL PRIMARY KEY,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // SMS 템플릿 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        usage_status VARCHAR(20) DEFAULT '미사용',
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // SMS 메시지 테이블 (PRD에 맞게 수정)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_messages (
        id SERIAL PRIMARY KEY,
        recipient_name VARCHAR(100),
        recipient_phone VARCHAR(20) NOT NULL,
        sms_type VARCHAR(50) NOT NULL,
        template_id INTEGER REFERENCES sms_templates(id),
        content TEXT NOT NULL,
        payment_amount INTEGER,
        product_id INTEGER REFERENCES products(id),
        product_payment_link VARCHAR(500),
        success_status VARCHAR(20) DEFAULT '실패',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 결제 정보 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        payment_method VARCHAR(50) NOT NULL,
        pg_transaction_id VARCHAR(200),
        payment_amount INTEGER NOT NULL,
        payment_status VARCHAR(50) DEFAULT '입금대기',
        payment_completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // =========================================================================
    // SMS 인증 (회원가입용) 테이블
    // -------------------------------------------------------------------------
    // 요구 스펙의 "sms_verification(phone, code, expire, verified)" 을
    // 아래와 같이 맵핑한 테이블입니다.
    //   - phone_number  ← phone  : 휴대폰 번호(숫자만, 예: 01012345678)
    //   - code          ← code   : 발급된 6자리 인증번호
    //   - expires_at    ← expire : 만료시각 (발급 시점 + 3분)
    //   - verified      ← verified : 인증 성공 여부 (true/false)
    //   - attempts      : 인증번호 입력 시도 횟수 (무차별 대입 방지용)
    //   - verified_at   : 인증이 성공한 시각 (회원가입 시 유효 기간 확인용)
    //   - created_at    : 발급 요청 시각 (가장 최근 기록을 찾을 때 사용)
    // =========================================================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_verifications (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL,
        code VARCHAR(10) NOT NULL,
        verified BOOLEAN DEFAULT false,
        attempts INTEGER DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sms_verifications_phone
      ON sms_verifications(phone_number, created_at DESC)
    `)

    // 메인 배너 (사용자 홈 슬라이더)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS main_banners (
        id SERIAL PRIMARY KEY,
        image_url VARCHAR(500) NOT NULL,
        link_url TEXT,
        display_order INTEGER DEFAULT 0,
        display_time INTEGER DEFAULT 3,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 이전 컬럼명 (image_path / sort_order) 호환 마이그레이션
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='main_banners' AND column_name='image_path')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='main_banners' AND column_name='image_url') THEN
          ALTER TABLE main_banners RENAME COLUMN image_path TO image_url;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='main_banners' AND column_name='sort_order')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='main_banners' AND column_name='display_order') THEN
          ALTER TABLE main_banners RENAME COLUMN sort_order TO display_order;
        END IF;
      END $$;
    `)

    await pool.query(`
      ALTER TABLE main_banners
        ADD COLUMN IF NOT EXISTS link_url TEXT,
        ADD COLUMN IF NOT EXISTS display_time INTEGER DEFAULT 3,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `)

    console.log('데이터베이스 테이블 초기화 완료')
  } catch (error) {
    console.error('데이터베이스 초기화 실패:', error)
    throw error
  }
}

export default initDatabase

