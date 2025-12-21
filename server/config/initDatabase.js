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
        address TEXT,
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

    // 기존 데이터에 customer_id가 없으면 추가 (마이그레이션 스크립트에서 처리)
    // initDatabase에서는 테이블 생성만 수행

    // 회원 유형 테이블 (한 회원이 여러 유형을 가질 수 있음)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_types (
        id SERIAL PRIMARY KEY,
        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
        member_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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
        available_for_non_business BOOLEAN DEFAULT false,
        available_for_individual_business BOOLEAN DEFAULT false,
        available_for_corporate_business BOOLEAN DEFAULT false,
        display_status VARCHAR(20) DEFAULT '비진열',
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 주문 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        member_id INTEGER REFERENCES members(id),
        product_id INTEGER REFERENCES products(id),
        order_code VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT '결제 완료',
        payment_amount INTEGER NOT NULL,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

    // SMS 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms (
        id SERIAL PRIMARY KEY,
        member_id INTEGER REFERENCES members(id),
        recipient VARCHAR(20) NOT NULL,
        sms_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        success_status VARCHAR(20) DEFAULT '실패',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.log('데이터베이스 테이블 초기화 완료')
  } catch (error) {
    console.error('데이터베이스 초기화 실패:', error)
    throw error
  }
}

export default initDatabase

