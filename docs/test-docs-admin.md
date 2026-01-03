
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

## 4️⃣ Test Admin Booking Management (Giai đoạn 3)

### Mục tiêu
Kiểm tra trang quản lý bookings cho admin với đầy đủ CRUD operations và quy trình refund.

### 4.1. Truy cập trang Admin Bookings

#### Các bước
```
1. Login với admin
2. Click "Bookings" trong navigation bar
   Hoặc truy cập http://localhost:5173/admin/bookings
```

#### Checklist
- [ ] Route `/admin/bookings` hoạt động
- [ ] Navigation link "Bookings" được highlight khi active
- [ ] Trang load thành công với 3 sections:
  - Bộ lọc
  - Danh sách bookings
  - Pagination

---

### 4.2. Test LIST Bookings với Filters

#### API được gọi
```http
GET /admin/bookings?status=CONFIRMED&limit=20&offset=0
Authorization: Bearer <token>
```

#### Expected Response
```json
{
  "data": [
    {
      "id": "uuid",
      "reference": "BK-20260103-001",
      "status": "CONFIRMED",
      "totalPrice": 500000,
      "contactName": "Nguyễn Văn A",
      "contactEmail": "a@example.com",
      "contactPhone": "0901234567",
      "createdAt": "2026-01-03T10:00:00Z",
      "trip": {
        "id": 1,
        "departureTime": "2026-01-05T08:00:00Z",
        "route": {
          "originCity": { "name": "HCM" },
          "destinationCity": { "name": "Hà Nội" }
        },
        "bus": {
          "name": "Xe VIP 01",
          "plateNumber": "51A-12345"
        }
      },
      "details": [
        {
          "id": 1,
          "passengerName": "Nguyễn Văn A",
          "passengerPhone": "0901234567",
          "seatCodeSnapshot": "A1",
          "priceSnapshot": 500000
        }
      ],
      "payment": {
        "status": "SUCCESS",
        "amount": 500000,
        "provider": "STRIPE",
        "refundedAt": null
      }
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

#### Checklist hiển thị
- [ ] Danh sách hiển thị trong table layout
- [ ] Columns: Mã booking | Khách hàng | Tuyến | Ngày đi | Số ghế | Tổng tiền | Trạng thái | Thao tác
- [ ] Status badges đúng màu:
  - PENDING: vàng (bg-yellow-600/30 text-yellow-300)
  - CONFIRMED: xanh lá (bg-green-600/30 text-green-300)
  - CANCELLED: đỏ (bg-error/30 text-error)
  - EXPIRED: xám (bg-gray-600/30 text-gray-400)
- [ ] Hiển thị booking reference (font-mono, text-primary)
- [ ] Hiển thị tuyến: "Origin → Destination"
- [ ] Số ghế format: "N ghế"
- [ ] Tổng tiền format: VND với thousand separator
- [ ] Empty state: "Không có booking nào" khi list rỗng

---

### 4.3. Test Filters

#### Filter: Trạng thái
```
Dropdown có options:
- Tất cả
- Chờ xử lý (PENDING)
- Đã xác nhận (CONFIRMED)
- Đã hủy (CANCELLED)
- Hết hạn (EXPIRED)
```

**Checklist:**
- [ ] Chọn từng status → API gọi với param `?status=X`
- [ ] Danh sách chỉ hiển thị bookings đúng status
- [ ] Counter cập nhật: "Danh sách Bookings (N)"
- [ ] Offset reset về 0 khi đổi filter

#### Filter: Khoảng thời gian
- [ ] Field "Từ ngày": Input type date
- [ ] Field "Đến ngày": Input type date
- [ ] API call với params: `?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`
- [ ] Filter bookings theo createdAt

#### Filter: Tìm kiếm
- [ ] Input placeholder: "Tên, email, hoặc mã booking..."
- [ ] API call với param: `?search=keyword`
- [ ] Tìm kiếm trong: contactName, contactEmail, reference

#### Test kết hợp filters
- [ ] Status + Date range
- [ ] Status + Search
- [ ] All filters cùng lúc
- [ ] Clear filters reset về default

---

### 4.4. Test VIEW Booking Details

#### Các bước
```
1. Click nút "Chi tiết" trên một booking
2. Drawer slide từ bên phải
3. Hiển thị đầy đủ thông tin booking
```

#### API được gọi
```http
GET /admin/bookings/:reference
Authorization: Bearer <token>
```

#### Expected Response
```json
{
  "id": "uuid",
  "reference": "BK-20260103-001",
  "status": "CONFIRMED",
  "totalPrice": 500000,
  "contactName": "Nguyễn Văn A",
  "contactEmail": "a@example.com",
  "contactPhone": "0901234567",
  "createdAt": "2026-01-03T10:00:00Z",
  "trip": { ... },
  "details": [ ... ],
  "payment": {
    "status": "SUCCESS",
    "provider": "STRIPE",
    "amount": 500000,
    "refundedAt": null,
    "refundAmount": null,
    "refundReason": null,
    "refundMethod": null
  }
}
```

#### Checklist - Booking Detail Drawer
- [ ] Drawer slide in animation
- [ ] Header: "Chi tiết Booking" với nút close (✕)
- [ ] Section 1: **Thông tin chung**
  - Mã booking (font-mono)
  - Trạng thái (badge màu)
  - Ngày đặt (format vi-VN)
  - Tổng tiền (format VND)

- [ ] Section 2: **Thông tin liên hệ**
  - Họ tên
  - Email
  - Số điện thoại (nếu có)

- [ ] Section 3: **Thông tin chuyến đi**
  - Tuyến
  - Từ: Origin city
  - Đến: Destination city
  - Giờ khởi hành (datetime format)
  - Xe: Bus name (plate number)

- [ ] Section 4: **Danh sách hành khách**
  - Số lượng: "(N hành khách)"
  - Mỗi passenger card hiển thị:
    - Tên (font-semibold)
    - Ghế: Seat code
    - Giá: Price format VND
    - SĐT (nếu có)

- [ ] Section 5: **Thông tin thanh toán**
  - Phương thức: Provider name
  - Trạng thái: Payment status
  - Số tiền: Amount format VND
  - **Nếu đã refund:** Hiển thị refund info panel:
    - Số tiền hoàn
    - Lý do
    - Phương thức
    - Thời gian (datetime format)

- [ ] Section 6: **Hành động** (Actions)
  - Nút "Xác nhận booking" (chỉ hiện khi status = PENDING)
  - Nút "Hủy booking" (chỉ hiện khi status != CANCELLED && != EXPIRED)
  - Nút "Xử lý hoàn tiền" (chỉ hiện khi payment.status = SUCCESS && chưa refund)

#### Test close drawer
- [ ] Click nút ✕ → Drawer close
- [ ] Click ngoài drawer → Drawer close

---

### 4.5. Test UPDATE Booking Status

#### Scenario 1: Xác nhận booking (PENDING → CONFIRMED)

**Các bước:**
```
1. Tìm booking có status = PENDING
2. Click "Chi tiết"
3. Click "Xác nhận booking"
4. Confirm trong dialog
5. Verify status đổi sang CONFIRMED
```

**API được gọi:**
```http
PATCH /admin/bookings/:reference/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CONFIRMED"
}
```

**Checklist:**
- [ ] Confirm dialog: "Bạn có chắc muốn đổi trạng thái..."
- [ ] Click OK → API call success
- [ ] Drawer close
- [ ] Danh sách reload
- [ ] Status badge đổi màu sang xanh lá
- [ ] Success message: "Cập nhật trạng thái thành công!"

#### Scenario 2: Hủy booking

**Các bước:**
```
1. Tìm booking có status != CANCELLED
2. Click "Chi tiết"
3. Click "Hủy booking"
4. Confirm
```

**API được gọi:**
```http
PATCH /admin/bookings/:reference/status
Authorization: Bearer <token>

{
  "status": "CANCELLED"
}
```

**Checklist:**
- [ ] Confirm dialog hiển thị
- [ ] Status đổi sang CANCELLED
- [ ] Badge đổi màu đỏ
- [ ] Nút "Hủy booking" biến mất sau khi hủy

#### Test Edge Cases
- [ ] Update booking không tồn tại → 404 error
- [ ] Update booking đã CANCELLED → Error message
- [ ] Hủy booking đã có payment SUCCESS → Vẫn hủy được (admin override)

---

### 4.6. Test REFUND Process

#### Scenario: Xử lý hoàn tiền thành công

**Điều kiện:** Booking có payment.status = 'SUCCESS' và chưa refund

**Các bước:**
```
1. Tìm booking đã CONFIRMED và đã thanh toán
2. Click "Chi tiết"
3. Click "Xử lý hoàn tiền"
4. Modal refund hiển thị
5. Điền form:
   - Số tiền hoàn: 500000 (auto-fill = totalPrice)
   - Lý do: "Khách yêu cầu hủy"
   - Phương thức: MANUAL hoặc GATEWAY
6. Click "Xác nhận hoàn tiền"
7. Verify refund success
```

**API được gọi:**
```http
POST /admin/bookings/:reference/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500000,
  "reason": "Khách yêu cầu hủy",
  "method": "MANUAL"
}
```

#### Checklist - Refund Modal
- [ ] Modal title: "Xử lý hoàn tiền"
- [ ] Hiển thị booking reference (read-only)
- [ ] Hiển thị tổng tiền đã thanh toán (read-only)
- [ ] Field "Số tiền hoàn":
  - Type: number
  - Default value: booking.totalPrice
  - Min: 0
  - Max: booking.totalPrice
  - Required
- [ ] Field "Lý do hoàn tiền":
  - Type: textarea
  - Placeholder: "Nhập lý do hoàn tiền..."
  - Min height: 100px
  - Required
- [ ] Field "Phương thức hoàn tiền":
  - Type: select
  - Options:
    - "Thủ công (chuyển khoản trực tiếp)" → MANUAL
    - "Qua cổng thanh toán" → GATEWAY
  - Default: MANUAL
- [ ] Nút "Xác nhận hoàn tiền" (primary, disabled khi loading)
- [ ] Nút "Hủy" (ghost)
- [ ] Click X hoặc Hủy → Modal close

#### Checklist - After Refund Success
- [ ] Modal close
- [ ] Drawer close (hoặc reload detail)
- [ ] Success message: "Hoàn tiền thành công!"
- [ ] Danh sách reload
- [ ] **Vào detail lại:**
  - Payment section hiển thị refund info panel màu đỏ
  - "Đã hoàn tiền" badge
  - Số tiền hoàn
  - Lý do
  - Phương thức
  - Thời gian refund
- [ ] Nút "Xử lý hoàn tiền" biến mất

#### Test Validation
- [ ] Số tiền = 0 → Error "Số tiền hoàn không hợp lệ"
- [ ] Số tiền > totalPrice → Error "Số tiền hoàn không hợp lệ"
- [ ] Lý do rỗng → Error "Vui lòng nhập lý do hoàn tiền"
- [ ] Click Hủy → Không gọi API

#### Test Edge Cases
- [ ] Refund booking đã refund rồi → Error "Booking đã được hoàn tiền"
- [ ] Refund booking chưa thanh toán → Error "Booking chưa thanh toán"
- [ ] Refund booking reference không tồn tại → 404

---

### 4.7. Test Pagination

#### Checklist
- [ ] Hiển thị: "Trang 1 / 8 (Tổng: 150 bookings)"
- [ ] Nút "Trước" disabled khi ở trang 1
- [ ] Nút "Sau" disabled khi ở trang cuối
- [ ] Hiển thị tối đa 5 số trang
- [ ] Click số trang → Load trang đó
- [ ] Click Trước/Sau → Navigate
- [ ] Query params: `?limit=20&offset=40` (trang 3)
- [ ] Pagination reset về trang 1 khi đổi filter

---

## 5️⃣ Test Admin Reports Page (Giai đoạn 4)

### Mục tiêu
Kiểm tra trang Reports với biểu đồ trực quan và dữ liệu phân tích thật.

### 5.1. Truy cập trang Reports

#### Các bước
```
1. Login với admin
2. Click "Reports" trong navigation bar
   Hoặc truy cập http://localhost:5173/admin/reports
```

#### Checklist
- [ ] Route `/admin/reports` hoạt động
- [ ] Navigation link "Reports" được highlight khi active
- [ ] Trang load thành công với sections:
  - Khoảng thời gian selector
  - Summary cards (4 cards)
  - Biểu đồ xu hướng
  - Biểu đồ doanh thu
  - Biểu đồ top routes
  - Recent bookings table

---

### 5.2. Test Time Range Selector

#### API được gọi
```http
# Default: 7 ngày gần nhất
GET /admin/reports/summary?days=7
Authorization: Bearer <token>

# 14 ngày
GET /admin/reports/summary?days=14

# 30 ngày
GET /admin/reports/summary?days=30

# Custom range
GET /admin/reports/summary?from=2026-01-01&to=2026-01-10
```

#### Checklist
- [ ] Dropdown "Chọn khoảng" có options:
  - 7 ngày gần nhất (default)
  - 14 ngày gần nhất
  - 30 ngày gần nhất
  - Tùy chỉnh
- [ ] Chọn "7/14/30 ngày" → Gọi API với param `?days=N`
- [ ] Chọn "Tùy chỉnh":
  - Hiển thị 2 date pickers: "Từ ngày", "Đến ngày"
  - Cả 2 fields đều là type date
  - Chọn dates → Gọi API với `?from=...&to=...`
- [ ] Nút "Làm mới":
  - Click → Re-fetch data
  - Disabled khi loading
  - Text "Đang tải..." khi loading
- [ ] Auto-load khi thay đổi time range

---

### 5.3. Test Summary Cards

#### Expected Data từ API
```json
{
  "totals": {
    "bookings": 150,
    "confirmedBookings": 120,
    "users": 200,
    "activeUsers": 180,
    "revenue": 50000000
  },
  "trends": {
    "bookingsWoW": 12.5,
    "revenueWoW": -5.2,
    "revenueDoD": 8.3,
    "conversionDoD": 2.1
  },
  "today": {
    "revenue": 5000000,
    "conversionRate": 80.5
  }
}
```

#### Card 1: Tổng Bookings
**Checklist:**
- [ ] Hiển thị: totals.bookings (format: toLocaleString)
- [ ] Subtitle: "X đã xác nhận" (confirmedBookings)
- [ ] Trend: trends.bookingsWoW với suffix "WoW"
- [ ] Màu trend:
  - Xanh (text-green-400) nếu >= 0
  - Đỏ (text-red-400) nếu < 0
- [ ] Format trend: "+12.5% WoW" hoặc "-5.2% WoW"

#### Card 2: Tổng Doanh thu
**Checklist:**
- [ ] Hiển thị: revenue / 1000000 + "M" (ví dụ: "50.0M")
- [ ] Subtitle: "Hôm nay: Xđ" (today.revenue format VND)
- [ ] Trend: revenueWoW với "WoW"
- [ ] Màu trend tương tự Card 1

#### Card 3: Active Users
**Checklist:**
- [ ] Hiển thị: activeUsers (format với comma)
- [ ] Subtitle: "/ X tổng" (totals.users)
- [ ] Không có trend (hoặc hiển thị "—")

#### Card 4: Conversion Rate
**Checklist:**
- [ ] Hiển thị: conversionRate + "%" (ví dụ: "80.5%")
- [ ] Subtitle: "Hôm nay"
- [ ] Trend: conversionDoD với suffix " pts DoD"
- [ ] Format: "+2.1 pts DoD" hoặc "-1.5 pts DoD"

---

### 5.4. Test Bookings & Revenue Trends Chart

#### Data từ API
```json
{
  "daily": {
    "bookings": [
      { "date": "2026-01-01", "value": 10 },
      { "date": "2026-01-02", "value": 15 },
      { "date": "2026-01-03", "value": 8 }
    ],
    "revenue": [
      { "date": "2026-01-01", "value": 5000000 },
      { "date": "2026-01-02", "value": 7500000 },
      { "date": "2026-01-03", "value": 4000000 }
    ]
  }
}
```

#### Checklist - Chart hiển thị
- [ ] Card title: "Xu hướng Bookings & Doanh thu"
- [ ] Chart type: Line chart (2 lines)
- [ ] X axis: Ngày (format: "Jan 1", "Jan 2"...)
- [ ] Y axis trái: Số bookings
- [ ] Y axis phải: Doanh thu (format: "5k", "7.5k"...)
- [ ] Line 1 (Bookings):
  - Màu: #3b82f6 (blue)
  - Stroke width: 2
  - Dots: radius 3
  - Name: "Số booking"
- [ ] Line 2 (Revenue):
  - Màu: #10b981 (green)
  - Stroke width: 2
  - Dots: radius 3
  - Name: "Doanh thu"
- [ ] Legend hiển thị ở bottom
- [ ] Tooltip:
  - Background: #1a1d2e
  - Border: rgba(255,255,255,0.1)
  - Hiển thị date + values
  - Format bookings: số nguyên
  - Format revenue: "X.XXXđ" với toLocaleString

#### Test interactions
- [ ] Hover vào point → Tooltip hiển thị
- [ ] Tooltip format đúng:
  - Bookings: [value, "Bookings"]
  - Revenue: ["X.XXXđ", "Doanh thu"]
- [ ] Responsive: Chart resize khi window resize

---

### 5.5. Test Revenue Chart (Riêng)

#### Checklist
- [ ] Card title: "Doanh thu theo ngày"
- [ ] Chart type: Line chart (single line)
- [ ] X axis: Ngày
- [ ] Y axis: Doanh thu (format "5k", "10k"...)
- [ ] Line màu: #3b82f6
- [ ] Dots: fill blue, radius 4
- [ ] Active dot: radius 6
- [ ] Tooltip format: "X.XXXđ" + "Doanh thu"

---

### 5.6. Test Top Routes Chart

#### Data từ API
```json
{
  "topRoutes": [
    {
      "route": "HCM → Hà Nội",
      "bookings": 25,
      "revenue": 10000000,
      "load": 0.85
    },
    {
      "route": "HCM → Đà Nẵng",
      "bookings": 18,
      "revenue": 7000000,
      "load": 0.72
    }
  ]
}
```

#### Checklist
- [ ] Card title: "Top tuyến đường"
- [ ] Chart type: Bar chart (2 bars per route)
- [ ] X axis: Route names (truncate nếu > 20 chars)
- [ ] Y axis: Values
- [ ] Bar 1: Số booking
  - Fill: #3b82f6 (blue)
  - Name: "Số booking"
- [ ] Bar 2: Tỷ lệ lấp đầy (%)
  - Fill: #10b981 (green)
  - Name: "Tỷ lệ lấp đầy (%)"
  - Data: load * 100 (format: "85.0")
- [ ] Legend hiển thị
- [ ] Tooltip format:
  - Bookings: [value, "Bookings"]
  - Load factor: ["85.0%", "Tỷ lệ lấp đầy"]
  - Revenue: ["X.XXXđ", "Doanh thu"] (nếu có trong data)

---

### 5.7. Test Recent Bookings Table

#### Data từ API
```json
{
  "recentBookings": [
    {
      "id": "BK-001",
      "route": "HCM → Hà Nội",
      "pax": 2,
      "amount": 1000000,
      "status": "CONFIRMED",
      "createdAt": "2026-01-03T10:00:00Z"
    }
  ]
}
```

#### Checklist
- [ ] Card title: "Bookings gần đây"
- [ ] Table columns: Mã booking | Tuyến | Hành khách | Số tiền | Trạng thái
- [ ] Mã booking: font-mono, text-primary
- [ ] Tuyến: text-xs
- [ ] Hành khách: "N người"
- [ ] Số tiền: format VND với toLocaleString
- [ ] Status badges màu:
  - CONFIRMED: bg-green-600/30 text-green-300
  - PENDING: bg-yellow-600/30 text-yellow-300
  - CANCELLED: bg-error/30 text-error
- [ ] Hiển thị tối đa theo limit từ API
- [ ] Empty state: "Không có booking nào" nếu rỗng

---

### 5.8. Test Error Handling

#### Scenario: API error
```
1. Tắt backend server
2. Refresh trang Reports
3. Verify error message hiển thị
```

**Checklist:**
- [ ] Error message box:
  - Background: bg-error/10
  - Border: border-error/30
  - Text: text-error
  - Message: API error message hoặc "Không thể tải dữ liệu báo cáo"
- [ ] Charts không hiển thị khi có lỗi
- [ ] Summary cards không hiển thị
- [ ] Nút "Làm mới" vẫn hoạt động

#### Scenario: Empty data
```
Database không có dữ liệu trong khoảng thời gian
```

**Checklist:**
- [ ] Summary cards hiển thị 0
- [ ] Charts hiển thị rỗng (không có data points)
- [ ] Recent bookings: "Không có booking nào"
- [ ] Không có error message (đây là trạng thái hợp lệ)

---

### 5.9. Test Recharts TypeScript Issues (Build)

#### Kiểm tra TypeScript compliance
```bash
cd frontend
npm run build
```

**Checklist:**
- [ ] Build thành công không có TypeScript errors
- [ ] Formatter functions handle `undefined` values:
  - `value: number | undefined`
  - `name: string | undefined`
- [ ] Return fallback values khi undefined:
  - `['0', name || '']` cho value undefined
  - Return valid tuple format

---

## 🧪 Test Scenarios Tổng hợp (Giai đoạn 3 & 4)

### Scenario 1: Full Booking Management Workflow

```
1. Customer tạo booking qua UI (hoặc Postman)
2. Booking có status PENDING, payment INIT
3. Admin vào /admin/bookings
4. Filter status = PENDING → Thấy booking mới
5. Click "Chi tiết" → Xem thông tin đầy đủ
6. Click "Xác nhận booking" → Status đổi CONFIRMED
7. Customer thanh toán thành công → payment SUCCESS
8. Refresh booking detail → Thấy payment info
9. Customer yêu cầu hủy
10. Admin click "Xử lý hoàn tiền"
11. Điền lý do: "Khách hủy vì thay đổi kế hoạch"
12. Chọn phương thức: MANUAL
13. Submit → Refund thành công
14. Verify refund info hiển thị trong detail
15. Vào Reports page → Verify doanh thu không tính booking đã refund
```

---

### Scenario 2: Reports Data Verification

```
1. Vào /admin/reports
2. Chọn "7 ngày gần nhất"
3. Note số liệu trên Summary cards
4. Vào database, chạy query verify:

SELECT COUNT(*) FROM bookings
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

SELECT SUM(amount) FROM payments p
JOIN bookings b ON b.id::text = p."bookingId"
WHERE p.status = 'SUCCESS'
AND b.status = 'CONFIRMED'
AND p.updated_at >= CURRENT_DATE - INTERVAL '7 days';

5. Compare với Reports page
6. Verify charts hiển thị đúng trend
7. Test custom date range
8. Verify top routes có load factor chính xác
```

---

### Scenario 3: Refund Impact on Reports

```
1. Note doanh thu hiện tại trên Reports
2. Tạo booking + payment SUCCESS
3. Refresh Reports → Verify revenue tăng
4. Refund booking đó qua Admin Bookings
5. Refresh Reports
6. Verify:
   - Revenue không giảm (vì query chỉ tính SUCCESS chưa refund)
   - Hoặc nếu có logic trừ refund, verify giảm đúng số tiền
```

---

## 📊 Test Checklist Summary (Updated)

### Admin Bookings (Giai đoạn 3)
- [ ] Trang /admin/bookings tồn tại
- [ ] Navigation link "Bookings"
- [ ] LIST với filters (status, date, search)
- [ ] Pagination hoạt động
- [ ] VIEW detail drawer đầy đủ
- [ ] UPDATE status (Confirm, Cancel)
- [ ] REFUND process hoàn chỉnh
- [ ] Refund modal validation
- [ ] Refund info hiển thị
- [ ] Success/Error messages
- [ ] API integration đúng

### Admin Reports (Giai đoạn 4)
- [ ] Trang /admin/reports tồn tại
- [ ] Navigation link "Reports"
- [ ] Time range selector (7/14/30/custom)
- [ ] Summary cards (4 cards)
- [ ] Bookings & Revenue trends chart
- [ ] Revenue chart riêng
- [ ] Top routes chart với load factor
- [ ] Recent bookings table
- [ ] Charts responsive
- [ ] Tooltips format đúng
- [ ] Error handling
- [ ] TypeScript build success
- [ ] Recharts types đúng

---

## 🐛 Common Issues & Troubleshooting (Updated)

### Issue 6: UUID = VARCHAR error trong Reports
**Triệu chứng:** 500 error: "operator does not exist: uuid = character varying"

**Nguyên nhân:** booking.id (UUID) không match với payment.bookingId (VARCHAR)

**Cách fix:**
```typescript
// Trong reports.service.ts, tất cả joins cần cast:
.innerJoin(Booking, 'booking', 'booking.id::text = payment."bookingId"')
```

---

### Issue 7: Recharts TypeScript errors khi build
**Triệu chứng:** Build fail với lỗi formatter types

**Nguyên nhân:** Recharts formatter có thể nhận `undefined` values

**Cách fix:**
```typescript
formatter={(value: number | undefined, name: string | undefined) => {
  if (value === undefined) return ['0', name || ''];
  // ... rest of logic
}}
```

---

### Issue 8: Refund không hoạt động
**Triệu chứng:** Click "Xử lý hoàn tiền" nhưng không có gì xảy ra

**Kiểm tra:**
```javascript
// F12 → Console
// Check errors
// Check API call status code

// Verify payment entity có refund fields:
SELECT * FROM payments WHERE "bookingId" = '...';
// Phải có columns: refundAmount, refundReason, refundMethod, refundedAt
```

---

### Issue 9: Charts không hiển thị data
**Triệu chứng:** Charts render nhưng trống

**Nguyên nhân:**
- API không trả về daily series
- Data format không đúng

**Cách debug:**
```javascript
// F12 → Console → Check API response
console.log('Reports data:', data);
console.log('Daily bookings:', data?.daily?.bookings);
console.log('Daily revenue:', data?.daily?.revenue);

// Verify data structure matches chart props
```

---

## 🎯 Next Steps (Updated)

Sau khi test xong Giai đoạn 3 và 4, có thể tiếp tục với:

1. **Giai đoạn 5**: Trip Operations (passenger check-in, operational status)
2. **Giai đoạn 6**: Admin User Management (edit roles, deactivate)
3. **Giai đoạn 7**: Hoàn thiện (pagination cho routes, soft delete)
4. **Advanced features**: Redis caching, Docker, CI/CD, Tests

Tham khảo file `Claude_plan.md` để biết chi tiết các giai đoạn tiếp theo.

---

**Generated:** 2026-01-03
**Version:** 2.0
**Status:** ✅ Ready for testing (Giai đoạn 3 & 4 completed)
