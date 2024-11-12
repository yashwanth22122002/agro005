import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'agromanage',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    // Drop existing tables in reverse order to handle foreign key constraints
    await connection.execute('DROP TABLE IF EXISTS order_items');
    await connection.execute('DROP TABLE IF EXISTS orders');
    await connection.execute('DROP TABLE IF EXISTS products');
    await connection.execute('DROP TABLE IF EXISTS weather_alerts');
    await connection.execute('DROP TABLE IF EXISTS loans');
    await connection.execute('DROP TABLE IF EXISTS users');

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'farmer') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        category ENUM('Seeds', 'Fertilizers', 'Pesticides') NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        image_url TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    // Create order_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price_per_unit DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
      )
    `);

    // Create loans table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS loans (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        term_months INT NOT NULL,
        type VARCHAR(100) NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'paid') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    // Create weather_alerts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS weather_alerts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        type VARCHAR(100) NOT NULL,
        severity ENUM('low', 'medium', 'high') NOT NULL,
        description TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create default admin user if it doesn't exist
    const hashedPassword = await bcrypt.hash('admin123', 10);
    try {
      await connection.execute(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@agromanage.com', hashedPassword, 'admin']
      );
    } catch (error) {
      // If admin user already exists, ignore the error
      if (error.code !== 'ER_DUP_ENTRY') {
        throw error;
      }
    }

    // Add some sample products
    const sampleProducts = [
      {
        name: 'Organic Fertilizer',
        category: 'Fertilizers',
        price: 499.99,
        stock: 100,
        image_url: 'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=500',
        description: 'High-quality organic fertilizer for better crop yield'
      },
      {
        name: 'Hybrid Tomato Seeds',
        category: 'Seeds',
        price: 199.99,
        stock: 50,
        image_url: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=500',
        description: 'Disease-resistant hybrid tomato seeds'
      },
      {
        name: 'Natural Pesticide',
        category: 'Pesticides',
        price: 299.99,
        stock: 75,
        image_url: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=500',
        description: 'Eco-friendly pesticide for pest control'
      }
    ];

    for (const product of sampleProducts) {
      try {
        await connection.execute(
          'INSERT INTO products (name, category, price, stock, image_url, description) VALUES (?, ?, ?, ?, ?, ?)',
          [product.name, product.category, product.price, product.stock, product.image_url, product.description]
        );
      } catch (error) {
        // If product already exists, ignore the error
        if (error.code !== 'ER_DUP_ENTRY') {
          throw error;
        }
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export default pool;