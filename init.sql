CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Aberto'
);

-- SENHA: admin123 (já hasheada com bcrypt)
INSERT INTO users (username, password) VALUES 
('admin', '$2b$10$wH8Q1mZ9mJH9lQ8H8l1Q1eXH6gQp7lQwz7K8uF1rJp7F6mFQz0zQK');

INSERT INTO items (name, category) VALUES 
('Arroz Branco', 'Base'),
('Feijão Preto', 'Grão');