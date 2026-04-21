import pool from './config/database.js'

const checkOrders = async () => {
  try {
    // orders 테이블의 모든 주문 조회
    const result = await pool.query(`
      SELECT 
        o.id,
        o.order_id,
        o.member_id,
        o.product_id,
        o.category_name,
        o.product_name,
        o.product_price,
        o.status,
        o.payment_date,
        o.cancel_amount,
        o.cancel_date,
        o.created_at,
        m.name as member_name,
        m.business_name,
        m.phone_number
      FROM orders o
      LEFT JOIN members m ON o.member_id = m.id
      ORDER BY o.created_at DESC
    `)

    console.log(`\n=== 주문 데이터 확인 ===`)
    console.log(`총 주문 개수: ${result.rows.length}개\n`)

    if (result.rows.length === 0) {
      console.log('주문 데이터가 없습니다.')
    } else {
      console.log('주문 목록:')
      result.rows.forEach((order, index) => {
        console.log(`\n[${index + 1}] 주문 ID: ${order.order_id}`)
        console.log(`   - 주문 번호: ${order.id}`)
        console.log(`   - 회원 ID: ${order.member_id}`)
        console.log(`   - 회원명: ${order.member_name || order.business_name || 'N/A'}`)
        console.log(`   - 연락처: ${order.phone_number || 'N/A'}`)
        console.log(`   - 상품 ID: ${order.product_id}`)
        console.log(`   - 카테고리명: ${order.category_name || 'N/A'}`)
        console.log(`   - 상품명: ${order.product_name || 'N/A'}`)
        console.log(`   - 상품 가격: ${order.product_price ? order.product_price.toLocaleString() + '원' : 'N/A'}`)
        console.log(`   - 상태: ${order.status || 'N/A'}`)
        console.log(`   - 결제일시: ${order.payment_date ? new Date(order.payment_date).toLocaleString('ko-KR') : 'N/A'}`)
        console.log(`   - 취소 금액: ${order.cancel_amount ? order.cancel_amount.toLocaleString() + '원' : '0원'}`)
        console.log(`   - 취소일시: ${order.cancel_date ? new Date(order.cancel_date).toLocaleString('ko-KR') : 'N/A'}`)
        console.log(`   - 생성일시: ${order.created_at ? new Date(order.created_at).toLocaleString('ko-KR') : 'N/A'}`)
      })
    }

    // 통계 정보
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = '결제완료' THEN 1 END) as completed,
        COUNT(CASE WHEN status = '신고진행중' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = '신고완료' THEN 1 END) as finished,
        COUNT(CASE WHEN status = '결제대기' THEN 1 END) as pending,
        COUNT(CASE WHEN cancel_amount > 0 THEN 1 END) as cancelled
      FROM orders
    `)

    const stats = statsResult.rows[0]
    console.log(`\n=== 주문 통계 ===`)
    console.log(`전체: ${stats.total}개`)
    console.log(`결제완료: ${stats.completed}개`)
    console.log(`신고진행중: ${stats.in_progress}개`)
    console.log(`신고완료: ${stats.finished}개`)
    console.log(`결제대기: ${stats.pending}개`)
    console.log(`취소된 주문: ${stats.cancelled}개`)

    process.exit(0)
  } catch (error) {
    console.error('주문 데이터 확인 오류:', error)
    process.exit(1)
  }
}

checkOrders()

