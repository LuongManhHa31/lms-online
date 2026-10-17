# 🎓 HỆ THỐNG LMS ĐƠN GIẢN - ĐỀ 17 (DOCKER COMPOSE)

> **Đề tài 17**: Xây dựng hệ thống đào tạo trực tuyến LMS (Xem khóa học, bài học, đăng ký môn học, phân quyền Admin / Student) hoàn chỉnh đóng gói chạy bằng Docker Compose kết hợp hệ thống giám sát thời gian thực Prometheus, Grafana, Loki và Promtail.

---

## 📑 MỤC LỤC
1. [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
2. [Cấu Trúc Thư Mục](#-cấu-trúc-thư-mục)
3. [Danh Sách Dịch Vụ & Cổng Mạng (Ports)](#-danh-sách-dịch-vụ--cổng-mạng)
4. [Tài Khoản Kiểm Thử Mẫu](#-tài-khoản-kiểm-thử-mẫu)
5. [Hướng Dẫn Cài Đặt & Khởi Chạy](#-hướng-dẫn-cài-đặt--khởi-chạy)
6. [Kịch Bản Kiểm Thử Các Chức Năng (Test Flow)](#-kịch-bản-kiểm-thử-các-chức-năng)
7. [Kiểm Thử Giám Sát Prometheus, Grafana & Logs Loki](#-kiểm-thử-giám-sát-prometheus-grafana--logs-loki)
8. [Xử Lý Sự Cố Thường Gặp (Troubleshooting)](#-xử-lý-sự-cố-thường-gặp)

---

## 🏛 1. KIẾN TRÚC HỆ THỐNG

Hệ thống được thiết kế theo mô hình Microservices / Multi-container hiện đại:

```
                                  [ Trình duyệt Người dùng ]
                                              │
                                       (HTTP Cổng 80)
                                              ▼
                             ┌─────────────────────────────────┐
                             │    Nginx Reverse Proxy          │
                             │  - Phân luồng Web & phpMyAdmin  │
                             └──────────────┬──────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               │                            │                            │
               ▼                            ▼                            ▼
  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
  │   Web App LMS (Node.js) │  │  phpMyAdmin (Cổng 8081) │  │  Grafana (Cổng 3001)    │
  │   - Express.js & EJS    │  │  - Giao diện quản lý DB │  │  - Dashboard trực quan  │
  │   - Endpoint /metrics   │  └────────────┬────────────┘  └────────────┬────────────┘
  └────────────┬────────────┘               │                            │
               │                            │             ┌──────────────┴──────────────┐
               ▼                            ▼             ▼                             ▼
  ┌──────────────────────────────────────────────┐  ┌───────────────┐           ┌───────────────┐
  │             MySQL 8.0 Database               │  │  Prometheus   │           │     Loki      │
  │     (lms_db: users, courses, lessons...)     │  │  (Cổng 9090)  │           │  (Cổng 3100)  │
  └──────────────────────────────────────────────┘  └───────▲───────┘           └───────▲───────┘
                                                            │                           │
                                                    ┌───────┴───────┐           ┌───────┴───────┐
                                                    │   cAdvisor    │           │   Promtail    │
                                                    │  (Metrics CPU/│           │  (Thu thập log│
                                                    │   RAM Docker) │           │  Container)   │
                                                    └───────────────┘           └───────────────┘
```

---

## 📂 2. CẤU TRÚC THƯ MỤC

```
/home/luongmanhha/LMS-Online/
├── docker-compose.yml              # File điều phối toàn bộ 9 container dịch vụ
├── .env                            # Biến môi trường (mật khẩu DB, secret, cổng)
├── .env.example                    # File mẫu biến môi trường
├── verify-stack.sh                 # Script kiểm tra cấu hình tự động
├── README.md                       # Hướng dẫn chi tiết sử dụng & kiểm thử
│
├── database/
│   └── init.sql                    # Script khởi tạo CSDL: bảng & dữ liệu mẫu
│
├── nginx/
│   └── default.conf                # Cấu hình Reverse Proxy & Upstream
│
├── app/                            # Mã nguồn ứng dụng Web App LMS
│   ├── Dockerfile                  # Đóng gói Node.js 20 Alpine
│   ├── package.json                # Dependencies: express, mysql2, bcryptjs, prom-client...
│   └── src/
│       ├── app.js                  # Entry point chính của ứng dụng
│       ├── config/
│       │   └── db.js               # Connection Pool MySQL kèm auto-retry
│       ├── middleware/
│       │   ├── auth.js             # Phân quyền Admin / Student & Session
│       │   └── metrics.js          # Bộ thu thập Prometheus Metrics & /metrics
│       ├── routes/
│       │   ├── auth.js             # Đăng nhập, đăng ký, đăng xuất
│       │   ├── courses.js          # Danh sách, chi tiết & đăng ký khóa học
│       │   ├── lessons.js          # Xem video, nội dung & đánh dấu hoàn thành
│       │   ├── student.js          # Khóa học của tôi, tính % tiến độ
│       │   ├── admin.js            # Quản lý khóa học, bài học, phân quyền users
│       │   └── api.js              # Endpoint /health check
│       ├── views/                  # Giao diện EJS chuẩn Bootstrap 5 responsive
│       │   ├── layouts/            # Header, Footer, Navbar
│       │   ├── auth/               # Form Login, Register
│       │   ├── courses/            # Index & Detail khóa học
│       │   ├── lessons/            # Trình học Video & Sidebar giáo trình
│       │   ├── student/            # My Courses với tiến độ %
│       │   ├── admin/              # Dashboard, Courses CRUD, Lessons CRUD, Users Role
│       │   ├── index.ejs           # Landing page trang chủ
│       │   └── error.ejs           # Trang lỗi 404 / 500
│       └── public/
│           └── css/style.css       # Tùy biến giao diện hiện đại
│
└── monitoring/                     # Cấu hình Giám sát & Quản lý Logs
    ├── prometheus/
    │   └── prometheus.yml          # Cấu hình scrape interval & targets
    ├── loki/
    │   └── loki-config.yml         # Cấu hình lưu trữ log tập trung
    ├── promtail/
    │   └── promtail-config.yml     # Cấu hình đẩy Docker container logs vào Loki
    └── grafana/
        └── provisioning/
            ├── datasources/
            │   └── datasources.yml # Tự động nạp Prometheus & Loki làm datasource
            └── dashboards/
                ├── dashboards.yml  # Tự động nạp thư mục dashboard
                └── lms-overview.json # Dashboard mẫu: RPS, Latency, CPU/RAM, Live Logs
```

---

## 🌐 3. DANH SÁCH DỊCH VỤ & CỔNG MẠNG

| Dịch vụ | Tên Container | Cổng Host | Chức năng | URL Truy Cập |
| :--- | :--- | :--- | :--- | :--- |
| **Nginx Proxy** | `lms-nginx` | **80** | Cổng vào chính của hệ thống Web LMS | `http://localhost` |
| **LMS Web App** | `lms-app` | **3000** | Ứng dụng Node.js (truy cập trực tiếp) | `http://localhost:3000` |
| **phpMyAdmin** | `lms-phpmyadmin` | **8081** | Giao diện quản trị CSDL MySQL | `http://localhost:8081` |
| **MySQL Database**| `lms-mysql` | **3306** | Cơ sở dữ liệu quan hệ lưu trữ dữ liệu | `localhost:3306` |
| **Grafana** | `lms-grafana` | **3001** | Trực quan hóa Metrics & Logs tập trung | `http://localhost:3001` |
| **Prometheus** | `lms-prometheus` | **9090** | Server thu thập dữ liệu giám sát | `http://localhost:9090` |
| **cAdvisor** | `lms-cadvisor` | **8088** | Thu thập chỉ số tài nguyên Docker Container | `http://localhost:8088` |
| **Loki** | `lms-loki` | **3100** | Engine lưu trữ và truy vấn Logs | `http://localhost:3100` |
| **Promtail** | `lms-promtail` | - | Agent đẩy log container vào Loki | Nội bộ mạng Docker |

---

## 🔑 4. TÀI KHOẢN KIỂM THỬ MẪU

Hệ thống đã nạp sẵn dữ liệu khởi tạo trong `database/init.sql`:

### 👑 Tài khoản Quản Trị Viên (Admin):
- **Tên đăng nhập**: `admin`
- **Mật khẩu**: `admin123`
- **Quyền hạn**: Truy cập Dashboard thống kê, Thêm/Sửa/Xóa Khóa học, Thêm/Sửa/Xóa Bài học, Phân quyền người dùng (nâng Student lên Admin hoặc hạ xuống), Quản lý và hủy lượt đăng ký.

### 🎓 Tài khoản Học Viên (Student):
- **Tên đăng nhập**: `student`
- **Mật khẩu**: `student123`
- Hoặc tài khoản: `hocvien1` / `password123`
- **Quyền hạn**: Xem danh sách khóa học, xem chi tiết bài học, đăng ký môn học mới, học bài giảng video, đánh dấu hoàn thành bài học, theo dõi % tiến độ trong "Khóa học của tôi".

### 🗄 Tài khoản phpMyAdmin:
- **Tài khoản thường**: `lms_user` / mật khẩu: `lms_secret_2026`
- **Tài khoản Root**: `root` / mật khẩu: `root_super_secret_2026`

### 📊 Tài khoản Grafana:
- **Tài khoản**: `admin`
- **Mật khẩu**: `admin`

---

## 🚀 5. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY

### Bước 1: Cấp quyền chạy Docker không cần sudo (Nếu chưa cấp)
Nếu tài khoản chưa nằm trong nhóm `docker`, hãy chạy:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Bước 2: Kiểm tra tính hợp lệ của cấu hình
Chạy script kiểm tra tự động:
```bash
./verify-stack.sh
```

### Bước 3: Khởi chạy toàn bộ hệ thống bằng Docker Compose
Tại thư mục `/home/luongmanhha/LMS-Online`, chạy lệnh:
```bash
sudo docker compose up -d --build
```
> *Lệnh trên sẽ tự động build image Node.js LMS Web App, tải các container chính hãng từ Docker Hub, khởi tạo schema database MySQL và kích hoạt Nginx Reverse Proxy cùng hệ thống giám sát.*

### Bước 4: Kiểm tra trạng thái hoạt động của các container
```bash
sudo docker compose ps
```
Tất cả các container (`lms-nginx`, `lms-app`, `lms-mysql`, `lms-phpmyadmin`, `lms-prometheus`, `lms-grafana`, `lms-loki`, `lms-promtail`, `lms-cadvisor`) cần ở trạng thái `running` (hoặc `healthy`).

---

## 🧪 6. KỊCH BẢN KIỂM THỬ CÁC CHỨC NĂNG (TEST FLOW)

### Kịch bản A: Trải nghiệm của Học Viên (Student)
1. Mở trình duyệt truy cập: `http://localhost` (hoặc `http://localhost:3000`).
2. Nhấn nút **Đăng nhập** ở góc trên bên phải.
3. Nhấp vào nút chọn nhanh **Học viên: student / student123** và nhấn **Đăng nhập**.
4. Vào trang **Khóa học của tôi**: Quan sát các khóa đã đăng ký và thanh % tiến độ học tập.
5. Nhấn **Tất cả khóa học** trên thanh menu:
   - Dùng thanh tìm kiếm gõ từ khóa (ví dụ: `Node.js` hoặc `DevOps`).
   - Chọn bộ lọc theo danh mục (Lập Trình Web, DevOps, Cơ Sở Dữ Liệu).
6. Nhấn vào một khóa học để xem chi tiết:
   - Nếu chưa đăng ký: Nhấn nút **Đăng Ký Khóa Học Ngay**.
   - Nếu đã đăng ký: Nhấn nút **Tiếp Tục Học Tập**.
7. Vào giao diện học bài giảng:
   - Xem video YouTube được nhúng responsive.
   - Đọc nội dung hướng dẫn bên dưới.
   - Nhấn nút **Đánh dấu hoàn thành & sang bài tiếp** để ghi nhận tiến độ.
   - Quan sát dấu tích xanh `✓ Đã học` xuất hiện trên sidebar bên phải.
8. Thử nghiệm **Đăng ký tài khoản mới**:
   - Nhấn **Đăng xuất**.
   - Nhấn **Đăng ký** và tạo một tài khoản học viên mới. Hệ thống sẽ tự động đăng nhập và đưa vào giao diện học viên.

### Kịch bản B: Trải nghiệm của Quản Trị Viên (Admin)
1. Đăng nhập với tài khoản: `admin` / `admin123`.
2. Truy cập menu **Quản trị hệ thống** -> **Bảng điều khiển (Dashboard)**:
   - Quan sát 6 thẻ số liệu: Tổng số khóa học, bài học, người dùng, học viên, admin, lượt đăng ký.
   - Xem bảng các lượt đăng ký gần nhất.
3. Quản lý Khóa học (`/admin/courses`):
   - Nhấn **Thêm Khóa Học Mới**: Điền tên, chọn danh mục, giảng viên, mô tả và nhấn Lưu.
   - Sửa thông tin hoặc Xóa một khóa học bất kỳ.
4. Quản lý Bài học (`/admin/courses/:id/lessons`):
   - Trong danh sách khóa học, nhấn nút **Bài học (N bài)**.
   - Nhấn **Thêm Bài Học Mới**: Nhập số thứ tự, thời lượng, link video YouTube embed và nội dung HTML bài giảng.
   - Nhấn **Xem trước** để kiểm tra giao diện học viên nhìn thấy.
5. Quản lý Người dùng & Phân quyền (`/admin/users`):
   - Xem toàn bộ danh sách tài khoản đã đăng ký trong hệ thống.
   - Nhấn nút **Đặt làm Admin** để thăng cấp một học viên thành Quản trị viên.
   - Nhấn nút **Chuyển thành Student** để hạ quyền trở lại thành Học viên.
6. Quản lý Lượt Đăng Ký (`/admin/enrollments`):
   - Xem học viên nào đã đăng ký khóa học nào, thời gian đăng ký.
   - Thử nhấn **Hủy ĐK** để hủy lượt đăng ký của học viên.

---

## 📈 7. KIỂM THỬ GIÁM SÁT PROMETHEUS, GRAFANA & LOGS LOKI

### 1. Kiểm tra Endpoint Metrics & Health Check
- Mở `http://localhost/health`: Kiểm tra trạng thái CSDL và bộ nhớ RAM Node.js.
- Mở `http://localhost/metrics`: Xem toàn bộ metrics theo chuẩn Prometheus (`lms_http_requests_total`, `lms_http_request_duration_seconds`, v.v.).

### 2. Truy cập Prometheus Web UI
- Mở trình duyệt: `http://localhost:9090`
- Trong ô Expression, gõ các truy vấn mẫu:
  - `lms_http_requests_total`: Xem tổng số request đã gửi tới web app.
  - `rate(lms_http_requests_total[1m])`: Tốc độ request theo từng giây.
  - `container_memory_usage_bytes`: Mức tiêu thụ RAM của các container Docker.
- Vào menu **Status** -> **Targets**: Kiểm tra các target `lms-app`, `cadvisor`, `prometheus` đều ở trạng thái `UP` (màu xanh).

### 3. Trực quan hóa trên Grafana Dashboard (Tự động nạp sẵn)
- Mở trình duyệt: `http://localhost:3001`
- Đăng nhập: `admin` / `admin`.
- Vào menu **Dashboards** -> chọn thư mục **LMS System** -> mở dashboard:
  **"Hệ Thống LMS Đề 17 - Giám Sát Metrics & Logs"**
- Bạn sẽ thấy ngay lập tức:
  1. **Thống kê Tổng số HTTP Requests & Request Per Second (RPS)**.
  2. **Thời gian xử lý trung bình (Latency)** tính bằng giây/mili-giây.
  3. **Biểu đồ Lưu lượng theo HTTP Method & Status Code (200, 302, 404, 500)**.
  4. **Biểu đồ CPU & RAM của toàn bộ Container Docker** được cAdvisor cập nhật thời gian thực.
  5. **Bảng Logs Container Thời Gian Thực từ Loki & Promtail**: Tự động stream log truy cập của Nginx, LMS Web App và MySQL.

---

## 🛠 8. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

1. **Lỗi `bind: address already in use` (Trùng cổng 80 hoặc 3306)**:
   - Kiểm tra xem máy host có đang chạy Apache/Nginx hoặc MySQL cục bộ không:
     ```bash
     sudo ss -tulpn | grep -E ':80|:3306|:3000|:3001'
     ```
   - Nếu có dịch vụ chiếm cổng 80, bạn có thể đổi cổng trong `docker-compose.yml` (ví dụ `"8080:80"` cho service `nginx`).

2. **Xem log chi tiết của một dịch vụ cụ thể**:
   ```bash
   sudo docker compose logs -f lms-app
   sudo docker compose logs -f mysql
   sudo docker compose logs -f nginx
   ```

3. **Khởi động lại toàn bộ hệ thống hoặc reset dữ liệu**:
   - Dừng toàn bộ hệ thống:
     ```bash
     sudo docker compose down
     ```
   - Xóa cả dữ liệu volume để khởi tạo lại CSDL sạch từ đầu:
     ```bash
     sudo docker compose down -v
     sudo docker compose up -d --build
     ```

---
*Chúc bạn bảo vệ thành công Đề tài 17 Hệ thống LMS trên Docker!*
