
Tài liệu hướng dẫn test các chức năng Admin đã hoàn thành.

---

## 📋 Tổng quan các chức năng đã hoàn thành

### ✅ Hoàn thành 100%

1. **Dashboard** - Hiển thị dữ liệu thật từ database
2. **Trip Management** - Cancel endpoint, Status filter, Sort theo bookings
3. **Bus Management** - Trang quản lý xe đầy đủ với CRUD

---

## 🚀 Chuẩn bị môi trường test

### Backend
```bash
cd backend
npm run start:dev
# Backend chạy ở http://localhost:3000
```

### Frontend
```bash
cd frontend
npm run dev
# Frontend chạy ở http://localhost:5173
```

### Tài khoản admin để test
- Email: `admin@example.com` (hoặc tài khoản admin của bạn)
- Password: (mật khẩu của tài khoản admin)

---

## 1️⃣ Test Dashboard với dữ liệu thật

### Mục tiêu
Kiểm tra Dashboard hiển thị metrics thật từ database thay vì mock data.

### Các bước test

#### 1.1. Truy cập Dashboard
```
1. Login với tài khoản admin
2. Tự động redirect đến /dashboard
   Hoặc click "Dashboard" trong navigation
```

#### 1.2. Kiểm tra Summary Cards
- [ ] **Card 1 - Bookings hôm nay**: Hiển thị số bookings thật
- [ ] **Card 2 - Doanh thu hôm nay**: Hiển thị số tiền thật (VND)
- [ ] **Card 3 - Users đăng ký**: Hiển thị tổng số users
- [ ] **Card 4 - Conversion rate**: Hiển thị % thật

**Cách verify:**
- Mở Database/pgAdmin/SQL client
- Chạy query:
```sql
SELECT COUNT(*) FROM bookings WHERE DATE(created_at) = CURRENT_DATE;
SELECT SUM(total_amount) FROM bookings WHERE DATE(created_at) = CURRENT_DATE;
SELECT COUNT(*) FROM users;
```
- So sánh với số liệu trên Dashboard

#### 1.3. Kiểm tra Bookings Trend Chart (7 ngày)
- [ ] Hiển thị biểu đồ cột với 7 ngày gần nhất
- [ ] Mỗi cột có label ngày (Mon, Tue, Wed...)
- [ ] Số lượng bookings hiển thị chính xác

**Cách verify:**
```sql
SELECT DATE(created_at) as date, COUNT(*) as count
FROM bookings
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

#### 1.4. Kiểm tra Top Routes
- [ ] Hiển thị top routes với số bookings nhiều nhất
- [ ] Load factor (%) hiển thị đúng
- [ ] On-time percentage hiển thị
- [ ] Revenue hiển thị (format: 1M, 500k...)

#### 1.5. Kiểm tra Recent Bookings
- [ ] Hiển thị danh sách bookings gần đây
- [ ] Thông tin: route, reference, số hành khách, giá, status
- [ ] Status có màu sắc phù hợp:
  - CONFIRMED: xanh lá
  - PENDING: vàng
  - CANCELLED: đỏ

#### 1.6. Kiểm tra Thống kê hôm nay (card bên phải)
- [ ] Bookings hôm nay
- [ ] Doanh thu hôm nay
- [ ] Conversion rate
- [ ] Thống kê tuần này

### API endpoint được gọi
```
GET /admin/reports/summary
Authorization: Bearer <token>
```

### Expected Response Structure
```json
{
  "generatedAt": "2026-01-03T...",
  "totals": {
    "bookings": 150,
    "confirmedBookings": 120,
    "revenue": 50000000,
    "users": 200,
    "activeUsers": 180,
    "trips": { "upcoming": 50, "cancelled": 5 }
  },
  "today": {
    "bookings": 10,
    "confirmedBookings": 8,
    "revenue": 5000000,
    "conversionRate": 80
  },
  "daily": {
    "bookings": [
      { "date": "2026-01-01", "value": 5 },
      { "date": "2026-01-02", "value": 8 },
      ...
    ],
    "revenue": [...]
  },
  "topRoutes": [
    {
      "route": "HCM - Hà Nội",
      "bookings": 25,
      "revenue": 10000000,
      "load": 0.85,
      "onTime": 0.95
    },
    ...
  ],
  "recentBookings": [...]
}
```

### Lỗi thường gặp
- **Loading mãi**: Kiểm tra backend có chạy không, check console log
- **"Không thể tải dữ liệu"**: Kiểm tra JWT token, quyền admin
- **Dữ liệu = 0**: Database chưa có dữ liệu, cần seed data

---

## 2️⃣ Test Trip Management

### Mục tiêu
Kiểm tra các tính năng: Cancel trip, Filter theo status, Sort theo bookings.

### 2.1. Test Cancel Trip Endpoint

#### Các bước test
```
1. Vào /admin/trips
2. Tìm một trip có status = SCHEDULED
3. Click nút "Hủy chuyến"
4. Confirm trong dialog
5. Kiểm tra trip status đổi sang CANCELLED
```

#### Checklist
- [ ] Hiển thị dialog confirm trước khi hủy
- [ ] API call thành công
- [ ] Trip status cập nhật sang CANCELLED
- [ ] Badge hiển thị màu đỏ với text "Đã hủy"
- [ ] Nút "Hủy chuyến" biến mất sau khi hủy
- [ ] Danh sách trip reload và hiển thị đúng

#### API được gọi
```http
PATCH /admin/trips/:id/cancel
Authorization: Bearer <token>
```

#### Expected Response
```json
{
  "ok": true,
  "message": "Trip cancelled successfully",
  "affectedBookings": 5
}
```

#### Test Edge Cases
- [ ] Hủy trip đã CANCELLED → Should show error "Trip is already cancelled"
- [ ] Hủy trip không tồn tại → Should show 404 error
- [ ] Hủy trip có bookings → Kiểm tra affectedBookings count

#### Verify trong Database
```sql
SELECT id, status FROM trips WHERE id = <trip_id>;
-- Status phải là 'CANCELLED'
```

---

### 2.2. Test Status Filter

#### Các bước test
```
1. Vào /admin/trips
2. Tìm section "Bộ lọc"
3. Chọn dropdown "Trạng thái"
4. Test từng option
```

#### Checklist

**Filter: "Tất cả"**
- [ ] Hiển thị tất cả trips (không filter)

**Filter: "Đã lên lịch" (SCHEDULED)**
- [ ] Chỉ hiển thị trips có status = SCHEDULED
- [ ] Badge màu xanh lá

**Filter: "Đang chạy" (IN_PROGRESS)**
- [ ] Chỉ hiển thị trips có status = IN_PROGRESS
- [ ] Badge màu xanh dương

**Filter: "Hoàn thành" (COMPLETED)**
- [ ] Chỉ hiển thị trips có status = COMPLETED
- [ ] Badge màu xám

**Filter: "Đã hủy" (CANCELLED)**
- [ ] Chỉ hiển thị trips có status = CANCELLED
- [ ] Badge màu đỏ

#### API được gọi
```http
GET /admin/trips?status=SCHEDULED
GET /admin/trips?status=IN_PROGRESS
GET /admin/trips?status=COMPLETED
GET /admin/trips?status=CANCELLED
```

#### Test kết hợp filters
- [ ] Status + Route filter
- [ ] Status + Bus filter
- [ ] Status + Date range filter
- [ ] Status + Origin/Destination city

---

### 2.3. Test Sort theo Bookings

#### Các bước test
```
1. Vào /admin/trips
2. Tìm dropdown "Sắp xếp" trong Bộ lọc
3. Chọn "Theo số bookings"
4. Kiểm tra thứ tự hiển thị
```

#### Checklist
- [ ] Dropdown có 2 options:
  - "Theo thời gian" (default)
  - "Theo số bookings"
- [ ] Chọn "Theo số bookings": Trips được sắp xếp từ nhiều booking nhất → ít nhất
- [ ] Chọn "Theo thời gian": Trips sắp xếp theo departureTime DESC

#### API được gọi
```http
GET /admin/trips?sortBy=bookings
GET /admin/trips (không có sortBy = sort theo time)
```

#### Verify logic
- Backend JOIN với bảng bookings
- COUNT số bookings per trip
- ORDER BY count DESC

#### Test cases
- [ ] Trip có 0 bookings xuất hiện cuối danh sách
- [ ] Trip có nhiều bookings nhất xuất hiện đầu
- [ ] Kết hợp với filter khác (vd: status=SCHEDULED + sortBy=bookings)

---

### 2.4. Test Status Badge Display

#### Checklist hiển thị
- [ ] SCHEDULED: `bg-green-600/30 text-green-300` "Đã lên lịch"
- [ ] IN_PROGRESS: `bg-blue-600/30 text-blue-200` "Đang chạy"
- [ ] COMPLETED: `bg-white/10 text-gray-200` "Hoàn thành"
- [ ] CANCELLED: `bg-error/30 text-error` "Đã hủy"

---

## 3️⃣ Test Bus Management Page

### Mục tiêu
Kiểm tra trang quản lý xe mới được tạo với đầy đủ CRUD operations.

### 3.1. Truy cập trang

#### Các bước
```
1. Login với admin
2. Click "Buses" trong navigation bar
   Hoặc truy cập http://localhost:5173/admin/buses
```

#### Checklist
- [ ] Route `/admin/buses` hoạt động
- [ ] Navigation link "Buses" được highlight khi active
- [ ] Trang load thành công
- [ ] Hiển thị 3 cards: Form, Bộ lọc, Danh sách xe

---

### 3.2. Test CREATE Bus

#### Các bước test
```
1. Vào /admin/buses
2. Điền form "Thêm xe mới":
   - Tên xe: "Xe VIP 01"
   - Biển số: "51A-12345"
   - Loại xe: LIMOUSINE
   - Sơ đồ ghế: Chọn một seatMap
3. Click "Tạo xe"
4. Kiểm tra message thành công
```

#### Checklist
- [ ] Form có đủ fields:
  - Tên xe (text input)
  - Biển số (text input)
  - Loại xe (dropdown: STANDARD, SLEEPER, LIMOUSINE, MINIBUS)
  - Sơ đồ ghế (dropdown: list seat maps, có option "Chưa gán")
- [ ] Validation: Không để trống tên xe và biển số
- [ ] Success message: "Tạo xe thành công!" (màu xanh)
- [ ] Form reset sau khi tạo
- [ ] Danh sách xe reload và hiển thị xe mới
- [ ] Xe mới xuất hiện với đầy đủ thông tin

#### API được gọi
```http
POST /admin/buses
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Xe VIP 01",
  "plateNumber": "51A-12345",
  "busType": "LIMOUSINE",
  "seatMapId": 1
}
```

#### Test Edge Cases
- [ ] Biển số trùng → Error "Plate number already exists"
- [ ] Tạo xe không gán seatMap → seatMapId = null, vẫn tạo được
- [ ] Tên xe có ký tự đặc biệt → Accept
- [ ] Biển số tự động uppercase và trim

---

### 3.3. Test READ/LIST Buses

#### Checklist
- [ ] Danh sách hiển thị trong Card "Danh sách xe"
- [ ] Columns: Tên xe | Biển số | Loại xe | Sơ đồ ghế | Tiện ích | Thao tác
- [ ] Hiển thị đầy đủ thông tin:
  - Tên xe (bold, white)
  - Biển số (gray)
  - Loại xe (badge màu primary)
  - Sơ đồ ghế: "Name (rowsxcols)" hoặc "Chưa gán" (italic gray)
  - Tiện ích: Comma-separated hoặc "Không có"
- [ ] Counter hiển thị: "Danh sách xe (N)"
- [ ] Empty state: "Chưa có xe nào" khi list rỗng

#### API được gọi
```http
GET /admin/buses
Authorization: Bearer <token>
```

#### Expected Response
```json
[
  {
    "id": 1,
    "name": "Xe VIP 01",
    "plateNumber": "51A-12345",
    "busType": "LIMOUSINE",
    "amenities": ["WiFi", "AC"],
    "seatMap": {
      "id": 1,
      "name": "40 ghế",
      "rows": 10,
      "cols": 4
    }
  },
  ...
]
```

---

### 3.4. Test UPDATE Bus

#### Các bước test
```
1. Vào /admin/buses
2. Tìm một xe trong danh sách
3. Click nút "Sửa"
4. Form "Cập nhật xe" được populate với dữ liệu
5. Sửa thông tin (vd: đổi tên, đổi loại xe)
6. Click "Cập nhật"
7. Kiểm tra message thành công
```

#### Checklist
- [ ] Click "Sửa" → Form được fill với data của xe
- [ ] Card title đổi thành "Cập nhật xe"
- [ ] Button text đổi thành "Cập nhật"
- [ ] Có nút "Hủy" để cancel edit
- [ ] Cập nhật thành công → Message "Cập nhật xe thành công!"
- [ ] Danh sách reload và hiển thị dữ liệu mới
- [ ] Form reset về "Thêm xe mới"

#### API được gọi
```http
PATCH /admin/buses/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Xe VIP 01 - Upgraded",
  "plateNumber": "51A-12345",
  "busType": "LIMOUSINE",
  "seatMapId": 2
}
```

#### Test Edge Cases
- [ ] Sửa biển số thành biển số đã tồn tại → Error
- [ ] Click "Hủy" khi đang edit → Form reset
- [ ] Sửa và không thay đổi gì → Vẫn gọi API và success

---

### 3.5. Test DELETE Bus

#### Các bước test
```
1. Vào /admin/buses
2. Tìm một xe KHÔNG được sử dụng trong trip nào
3. Click nút "Xóa"
4. Confirm trong dialog
5. Kiểm tra xe biến mất khỏi danh sách
```

#### Checklist
- [ ] Click "Xóa" → Hiển thị confirm dialog
- [ ] Dialog message: "Xóa xe này? Hành động này không thể hoàn tác!"
- [ ] Click Cancel → Không xóa
- [ ] Click OK → Gọi API xóa
- [ ] Success: Xe biến mất khỏi danh sách
- [ ] Message "Xóa xe thành công!" (màu xanh)
- [ ] Counter cập nhật (giảm 1)

#### API được gọi
```http
DELETE /admin/buses/:id
Authorization: Bearer <token>
```

#### Expected Response
```json
{
  "ok": true
}
```

#### Test Edge Cases
- [ ] Xóa xe đang được assign vào trip → **Should prevent** (foreign key constraint)
- [ ] Xóa xe không tồn tại → 404 error
- [ ] Error message hiển thị: "Không thể xóa xe" (màu đỏ)

#### Verify trong Database
```sql
SELECT * FROM buses WHERE id = <deleted_id>;
-- Không còn record
```

---

### 3.6. Test Filters

#### Filter: Loại xe

```
1. Dropdown "Loại xe" có options:
   - Tất cả
   - STANDARD
   - SLEEPER
   - LIMOUSINE
   - MINIBUS
2. Chọn từng loại
3. Kiểm tra danh sách chỉ hiển thị xe đúng loại
```

**Checklist:**
- [ ] "Tất cả" → Hiển thị tất cả xe
- [ ] Mỗi busType → Filter đúng
- [ ] Filter client-side (không gọi API mới)
- [ ] Counter cập nhật theo số xe filtered

#### Filter: Sơ đồ ghế

```
1. Dropdown "Sơ đồ ghế" list tất cả seat maps
2. Chọn một seat map
3. Chỉ hiển thị xe có seatMapId đó
```

**Checklist:**
- [ ] "Tất cả" → Hiển thị tất cả xe
- [ ] Chọn seat map → Filter đúng
- [ ] Xe chưa gán seat map không hiển thị khi filter by seat map

#### Test kết hợp filters
- [ ] Filter busType + seatMapId cùng lúc
- [ ] Clear filters → Reset về "Tất cả"

---

## 🧪 Test Scenarios tổng hợp

### Scenario 1: Admin workflow hoàn chỉnh - Tạo Bus và Trip

```
1. Tạo Seat Map (nếu chưa có)
   - /admin/seat-maps → Tạo "40 ghế VIP"

2. Tạo Bus
   - /admin/buses → Tạo "Xe Limousine 01" với seat map vừa tạo

3. Tạo Route (nếu chưa có)
   - /admin/routes → Tạo route HCM - Đà Nẵng

4. Tạo Trip
   - /admin/trips → Tạo trip với bus và route vừa tạo
   - Kiểm tra trip được tạo thành công

5. Kiểm tra Dashboard
   - Vào /dashboard
   - Verify số liệu cập nhật (trips, routes...)
```

---

### Scenario 2: Cancel Trip và verify Dashboard

```
1. Tạo một trip mới với status SCHEDULED
2. Tạo vài bookings cho trip đó (qua UI customer hoặc Postman)
3. Vào Dashboard → Note số liệu hiện tại
4. Cancel trip
5. Refresh Dashboard
6. Verify:
   - Cancelled trips count tăng
   - Upcoming trips count giảm
   - Recent bookings có thể hiển thị booking bị cancel
```

---

### Scenario 3: Bus Management full CRUD

```
1. CREATE: Tạo bus "Test Bus 999"
2. READ: Verify bus xuất hiện trong list
3. UPDATE: Sửa thành "Test Bus 999 - Updated"
4. Verify: Kiểm tra trong list đã đổi tên
5. DELETE: Xóa bus
6. Verify: Bus biến mất khỏi list
```

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: Dashboard không load dữ liệu
**Triệu chứng:** Loading mãi hoặc hiển thị "Không thể tải dữ liệu"

**Nguyên nhân:**
- Backend chưa chạy
- JWT token hết hạn
- Không có quyền admin

**Cách fix:**
```bash
# Kiểm tra backend
curl http://localhost:3000/health

# Kiểm tra JWT token trong localStorage
# F12 → Application → Local Storage → accessToken

# Re-login nếu token hết hạn
```

---

### Issue 2: Filter/Sort không hoạt động
**Triệu chứng:** Chọn filter/sort nhưng danh sách không thay đổi

**Nguyên nhân:**
- State không update
- API không nhận params

**Cách debug:**
```javascript
// F12 → Console → Xem log
console.log('Filters:', filters);
console.log('API URL:', `/admin/trips?${params.toString()}`);
```

---

### Issue 3: Cannot delete bus - Foreign key constraint
**Triệu chứng:** Error khi xóa bus: "Foreign key constraint failed"

**Nguyên nhân:** Bus đang được sử dụng trong trips

**Cách fix:**
```sql
-- Kiểm tra trips sử dụng bus này
SELECT * FROM trips WHERE bus_id = <bus_id>;

-- Xóa trips trước (hoặc reassign bus)
DELETE FROM trips WHERE bus_id = <bus_id>;

-- Hoặc đổi bus của trip
UPDATE trips SET bus_id = <other_bus_id> WHERE bus_id = <bus_id>;
```

---

### Issue 4: Bus form validation error
**Triệu chứng:** "Vui lòng nhập tên xe và biển số"

**Nguyên nhân:** Thiếu required fields

**Cách fix:**
- Đảm bảo điền đủ Tên xe và Biển số
- Loại xe và Sơ đồ ghế là optional

---

### Issue 5: Status filter không có dữ liệu
**Triệu chứng:** Chọn filter status nhưng không có trip nào

**Nguyên nhân:** Database không có trip với status đó

**Cách fix:**
```sql
-- Tạo trips với các status khác nhau
INSERT INTO trips (route_id, bus_id, departure_time, arrival_time, base_price, status)
VALUES (1, 1, NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', 500000, 'SCHEDULED');

-- Hoặc update status của trip có sẵn
UPDATE trips SET status = 'IN_PROGRESS' WHERE id = 1;
UPDATE trips SET status = 'COMPLETED' WHERE id = 2;
UPDATE trips SET status = 'CANCELLED' WHERE id = 3;
```

---

## 📊 Test Checklist Summary

### Dashboard
- [x] Load dữ liệu thật từ API
- [x] Summary cards hiển thị đúng
- [x] Bookings trend chart 7 ngày
- [x] Top routes với load factor
- [x] Recent bookings
- [x] Thống kê hôm nay

### Trip Management
- [x] Cancel endpoint hoạt động
- [x] Status filter (4 options)
- [x] Sort theo bookings
- [x] Sort theo time (default)
- [x] Status badge đúng màu
- [x] Kết hợp filters

### Bus Management
- [x] Trang /admin/buses tồn tại
- [x] Navigation link "Buses"
- [x] CREATE bus
- [x] READ/LIST buses
- [x] UPDATE bus
- [x] DELETE bus
- [x] Filter theo busType
- [x] Filter theo seatMap
- [x] Form validation
- [x] Success/Error messages

---

## 📝 Test Report Template

Copy template này để ghi lại kết quả test:

```markdown
# Test Report - [Date]

## Tester: [Your Name]

## Dashboard
- [ ] Load dữ liệu thật: ✅ Pass / ❌ Fail
- [ ] Summary cards: ✅ Pass / ❌ Fail
- [ ] Charts: ✅ Pass / ❌ Fail
- **Issues:** [Ghi issue nếu có]

## Trip Management
- [ ] Cancel trip: ✅ Pass / ❌ Fail
- [ ] Status filter: ✅ Pass / ❌ Fail
- [ ] Sort bookings: ✅ Pass / ❌ Fail
- **Issues:** [Ghi issue nếu có]

## Bus Management
- [ ] CREATE: ✅ Pass / ❌ Fail
- [ ] READ: ✅ Pass / ❌ Fail
- [ ] UPDATE: ✅ Pass / ❌ Fail
- [ ] DELETE: ✅ Pass / ❌ Fail
- [ ] Filters: ✅ Pass / ❌ Fail
- **Issues:** [Ghi issue nếu có]

## Overall Status
✅ All tests passed / ⚠️ Some issues / ❌ Major issues

## Notes
[Ghi chú thêm]
```

---

## 🎯 Next Steps

Sau khi test xong các chức năng này, có thể tiếp tục với:

1. **Giai đoạn 3**: Booking Management cho Admin (với refund)
2. **Giai đoạn 4**: Reports Page với Charts
3. **Giai đoạn 5**: Trip Operations (passenger check-in)
4. **Giai đoạn 6**: Admin User Management

Tham khảo file `Claude_plan.md` để biết chi tiết các giai đoạn tiếp theo.

---

**Generated:** 2026-01-03
**Version:** 1.0
**Status:** ✅ Ready for testing
