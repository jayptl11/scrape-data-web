# Scrape Data Web

Web form đơn giản để cào tin tức theo từ khóa và khoảng thời gian, xuất JSON.

## Yêu cầu
- Node.js 18+

## Chạy local
```bash
npm install
npm start
```
Mở `http://localhost:3000`.

## Dữ liệu xuất ra
Mặc định xuất `CSV (UTF-8)`.
Có thể chọn `CSV (UTF-16LE)`, `CSV (Excel ANSI)` hoặc `JSON` trong UI.

CSV mặc định dùng dấu `;`.

CSV gồm các cột:
- `title`, `date` (ISO), `summary`, `url`

JSON (khi chọn) gồm:
- `meta`: thông tin truy vấn
- `items`: danh sách bài viết với `title`, `date` (ISO), `summary`, `url`

## Ghi chú
- Vietstock hiện dùng API tìm kiếm của họ để lấy danh sách bài viết.
- Khoảng thời gian được lọc theo ngày đăng.
