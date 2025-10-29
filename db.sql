-- Drop tables in reverse order to handle foreign key constraints
DROP TABLE IF EXISTS Admin;
DROP TABLE IF EXISTS MonthlyPass;
DROP TABLE IF EXISTS Reservation;
DROP TABLE IF EXISTS Payment;
DROP TABLE IF EXISTS ParkingSession;
DROP TABLE IF EXISTS ParkingSlot;
DROP TABLE IF EXISTS Vehicle;
DROP TABLE IF EXISTS Customer;

-- Create tables
CREATE TABLE Customer (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('customer', 'operator', 'admin') DEFAULT 'customer',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Vehicle (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    type ENUM('Car', 'Motorcycle', 'Truck', 'Other') NOT NULL,
    customer_id INT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE SET NULL
);

CREATE TABLE ParkingSlot (
    slot_id INT AUTO_INCREMENT PRIMARY KEY,
    slot_number VARCHAR(10) UNIQUE NOT NULL,
    slot_type ENUM('Compact', 'Large', 'Motorcycle') NOT NULL,
    is_occupied BOOLEAN DEFAULT FALSE,
    maintenance_mode BOOLEAN DEFAULT FALSE
);

CREATE TABLE ParkingSession (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    slot_id INT NOT NULL,
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMP NULL,
    total_fee DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES ParkingSlot(slot_id) ON DELETE CASCADE
);

CREATE TABLE Payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('Cash', 'Card', 'MobileMoney') NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES ParkingSession(session_id) ON DELETE CASCADE
);

CREATE TABLE Reservation (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    slot_id INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    status ENUM('Pending','Confirmed','Cancelled','Completed') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES ParkingSlot(slot_id) ON DELETE CASCADE
);

CREATE TABLE MonthlyPass (
    pass_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status ENUM('Active','Expired','Cancelled') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE
);

CREATE TABLE Admin (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin','Operator','Customer') DEFAULT 'Customer',
    customer_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE SET NULL
);

-- Insert Sample Customer Data (including admin users)
INSERT INTO Customer (full_name, phone, email, password, role) VALUES
('System Administrator', '0700000000', 'admin@example.com', '$2b$12$.GFI16Fe6/CBuWxnI6M0z.WHHSlYWz9sqTCp6cp.r5mCBfRMbYwze', 'admin'),
('Parking Operator', '0700000001', 'operator@example.com', '$2b$12$.GFI16Fe6/CBuWxnI6M0z.WHHSlYWz9sqTCp6cp.r5mCBfRMbYwze', 'operator'),
('John Smith', '+1234567890', 'john.smith@email.com', '$2b$12$.GFI16Fe6/CBuWxnI6M0z.WHHSlYWz9sqTCp6cp.r5mCBfRMbYwze', 'customer'),
('Sarah Johnson', '+1234567891', 'sarah.j@email.com', '$2b$12$.GFI16Fe6/CBuWxnI6M0z.WHHSlYWz9sqTCp6cp.r5mCBfRMbYwze', 'customer'),
('Mike Wilson', '+1234567892', 'mike.wilson@email.com', '$2b$12$.GFI16Fe6/CBuWxnI6M0z.WHHSlYWz9sqTCp6cp.r5mCBfRMbYwze', 'customer'),
('Emily Davis', '+1234567893', 'emily.davis@email.com', '$2b$12$.GFI16Fe6/CBuWxnI6M0z.WHHSlYWz9sqTCp6cp.r5mCBfRMbYwze', 'customer'),
('Robert Brown', '+1234567894', 'robert.b@email.com', '$2b$12$.GFI16Fe6/CBuWxnI6M0z.WHHSlYWz9sqTCp6cp.r5mCBfRMbYwze', 'customer');

-- Insert Sample Vehicle Data
INSERT INTO Vehicle (license_plate, type, customer_id, is_default) VALUES
('ABC123', 'Car', 3, TRUE),
('XYZ789', 'Car', 3, FALSE),
('MOTO001', 'Motorcycle', 4, TRUE),
('TRUCK99', 'Truck', 5, TRUE),
('DEF456', 'Car', 6, TRUE),
('GHI789', 'Car', 7, TRUE),
('MOTO002', 'Motorcycle', 5, FALSE);

-- Insert Sample Parking Slot Data
INSERT INTO ParkingSlot (slot_number, slot_type, is_occupied, maintenance_mode) VALUES
('A01', 'Compact', FALSE, FALSE),
('A02', 'Compact', FALSE, FALSE),
('A03', 'Large', FALSE, FALSE),
('A04', 'Large', TRUE, FALSE),
('A05', 'Motorcycle', FALSE, FALSE),
('B01', 'Compact', TRUE, FALSE),
('B02', 'Compact', FALSE, TRUE),
('B03', 'Large', FALSE, FALSE),
('B04', 'Motorcycle', FALSE, FALSE),
('B05', 'Motorcycle', FALSE, FALSE);

-- Insert Sample Parking Session Data
INSERT INTO ParkingSession (vehicle_id, slot_id, entry_time, exit_time, total_fee) VALUES
(1, 4, '2024-01-15 08:30:00', '2024-01-15 17:45:00', 25.50),
(3, 5, '2024-01-15 09:15:00', NULL, 0.00),
(4, 6, '2024-01-15 10:00:00', NULL, 0.00),
(2, 1, '2024-01-14 14:20:00', '2024-01-14 16:30:00', 12.00);

-- Insert Sample Payment Data
INSERT INTO Payment (session_id, amount, payment_method, paid_at) VALUES
(1, 25.50, 'Card', '2024-01-15 17:50:00'),
(4, 12.00, 'MobileMoney', '2024-01-14 16:35:00');

-- Insert Sample Reservation Data
INSERT INTO Reservation (customer_id, vehicle_id, slot_id, start_time, end_time, cost, status) VALUES
(4, 3, 5, '2024-01-16 09:00:00', '2024-01-16 18:00:00', 15.00, 'Confirmed'),
(6, 5, 3, '2024-01-17 10:00:00', '2024-01-17 16:00:00', 18.00, 'Pending'),
(3, 2, 1, '2024-01-15 14:00:00', '2024-01-15 16:00:00', 8.00, 'Completed');

-- Insert Sample Monthly Pass Data
INSERT INTO MonthlyPass (customer_id, vehicle_id, start_date, end_date, price, status) VALUES
(3, 1, '2024-01-01', '2024-01-31', 150.00, 'Active'),
(5, 4, '2024-01-01', '2024-01-31', 200.00, 'Active'),
(7, 6, '2023-12-01', '2023-12-31', 150.00, 'Expired');

-- Insert Sample Admin Data
INSERT INTO Admin (username, password_hash, role, customer_id) VALUES
('admin1', '$2b$10$adminhashedpassword1', 'Admin', NULL),
('operator1', '$2b$10$operatorhashed1', 'Operator', NULL),
('john_admin', '$2b$10$customeradmin1', 'Admin', 3),
('sarah_op', '$2b$10$customeroperator1', 'Operator', 4);

ALTER TABLE Vehicle MODIFY type VARCHAR(50) NOT NULL;
