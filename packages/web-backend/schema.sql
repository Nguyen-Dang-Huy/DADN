CREATE DATABASE IF NOT EXISTS iot_smart_home;
USE iot_smart_home;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, 
    feed_key VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'OFF', 
    current_value VARCHAR(50) DEFAULT NULL
);

CREATE TABLE sensor_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE action_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device VARCHAR(50),
    action VARCHAR(255),
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) UNIQUE,
    value VARCHAR(255)
);

-- Insert demo user (password: password123 - hashed)
-- This is a bcrypt hash of 'password123'
INSERT INTO users (username, password, email, role) VALUES 
('admin', '$2b$10$YourHashedPasswordHere', 'admin@smarthome.local', 'admin'),
('user', '$2b$10$UserHashedPasswordHere', 'user@smarthome.local', 'user');

INSERT INTO devices (name, type, feed_key, status) VALUES 
('Living Room Light', 'light', 'rgb-state', 'OFF'),
('Living Room Fan', 'fan', 'fan-state', 'OFF'),
('Front Door', 'door', 'door', 'CLOSED'),
('Living Room TV', 'tv', 'tv-state', 'OFF');

INSERT INTO system_configs (key_name, value) VALUES ('temperature_threshold', '30');