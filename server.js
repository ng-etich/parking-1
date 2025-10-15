// server.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const mysql = require("mysql");

const app = express();
const PORT = 3000;

// ===== DB Connection =====
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "kali",
  database: "Parking",
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL Connection Failed");
    process.exit(1);
  }
  console.log("✅ MySQL Connected");
  createAdminUsers();
});

// ===== Admin User Creation =====
async function createAdminUsers() {
 // In your createAdminUsers function, replace the plain passwords:
const adminUsers = [
  {
    full_name: 'System Administrator',
    phone: '0700000000',
    email: 'admin@example.com',
    password: await bcrypt.hash('admin123', 12), // Hash the password
    role: 'admin'
  },
  {
    full_name: 'Parking Operator', 
    phone: '0700000001',
    email: 'operator@example.com',
    password: await bcrypt.hash('operator123', 12), // Hash the password
    role: 'operator'
  }
];

  for (const admin of adminUsers) {
    try {
      db.query("SELECT * FROM Customer WHERE email = ?", [admin.email], async (err, results) => {
        if (err) return;
        
        if (results.length === 0) {
          try {
            const hashedPassword = await bcrypt.hash(admin.password, 12);
            db.query(
              "INSERT INTO Customer (full_name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)",
              [admin.full_name, admin.phone, admin.email, hashedPassword, admin.role],
              (err) => {
                if (!err) console.log(`✅ ${admin.role} user created`);
              }
            );
          } catch (hashError) {
            console.error(`❌ Password hashing error`);
          }
        } else {
          const existingUser = results[0];
          if (existingUser.role !== admin.role) {
            db.query(
              "UPDATE Customer SET role = ? WHERE customer_id = ?",
              [admin.role, existingUser.customer_id],
              (err) => {
                if (!err) console.log(`✅ Updated role for: ${admin.email}`);
              }
            );
          }
        }
      });
    } catch (error) {
      console.error("Error creating admin user");
    }
  }
}

// ===== Middleware =====
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "parking-system-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, 
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true
    }
  })
);

// ===== Global Template Variables =====
app.use((req, res, next) => {
  if (req.session.user) {
    res.locals.user = req.session.user;
    res.locals.isAdmin = req.session.user.role === 'admin';
    res.locals.isOperator = req.session.user.role === 'operator';
    res.locals.userRole = req.session.user.role;
  } else {
    res.locals.user = null;
    res.locals.isAdmin = false;
    res.locals.isOperator = false;
    res.locals.userRole = null;
  }
  next();
});

// ===== Role-Based Middleware =====
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect("/login?message=Please login to access this page");
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (req.session.user && roles.includes(req.session.user.role)) {
      next();
    } else {
      res.status(403).render("error", {
        message: "Access denied. Insufficient privileges.",
        status: 403
      });
    }
  };
};

// ===== Routes =====

// Home - Public
app.get("/", (req, res) => {
  res.render("index", { currentPage: "home" });
});

// ===== Authentication Routes =====
app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render('register', {
    message: '',
    full_name: '',
    phone: '',
    email: '',
    currentPage: 'register'
  });
});

app.post("/register", async (req, res) => {
  const { full_name, phone, email, password, confirmPassword } = req.body;
  
  if (!full_name || !phone || !email || !password || !confirmPassword) {
    return res.render("register", { 
      message: "All fields are required",
      currentPage: "register",
      full_name, phone, email
    });
  }

  if (password !== confirmPassword) {
    return res.render("register", { 
      message: "Passwords do not match",
      currentPage: "register",
      full_name, phone, email
    });
  }

  const phoneRegex = /^07[0-9]{8}$/;
  if (!phoneRegex.test(phone)) {
    return res.render("register", { 
      message: "Please enter a valid Kenyan phone number",
      currentPage: "register",
      full_name, phone, email
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.render("register", { 
      message: "Please enter a valid email address",
      currentPage: "register",
      full_name, phone, email
    });
  }

  if (password.length < 8) {
    return res.render("register", { 
      message: "Password must be at least 8 characters long",
      currentPage: "register",
      full_name, phone, email
    });
  }

  try {
    db.query("SELECT * FROM Customer WHERE email = ? OR phone = ?", [email, phone], async (err, results) => {
      if (err) {
        return res.render("register", { 
          message: "System error. Please try again later.",
          currentPage: "register",
          full_name, phone, email
        });
      }
      
      if (results.length > 0) {
        const existingUser = results[0];
        let errorMessage = "An account with this ";
        errorMessage += existingUser.email === email && existingUser.phone === phone ? 
          "email and phone number already exists" : 
          existingUser.email === email ? "email already exists" : "phone number already exists";
        
        return res.render("register", { 
          message: errorMessage,
          currentPage: "register",
          full_name, phone, email
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      db.query(
        "INSERT INTO Customer (full_name, phone, email, password, role) VALUES (?, ?, ?, ?, 'customer')",
        [full_name, phone, email, hashedPassword],
        (err) => {
          if (err) {
            const message = err.code === 'ER_DUP_ENTRY' ? 
              "Email or phone number already registered" : 
              "Registration failed. Please try again.";
            return res.render("register", { 
              message,
              currentPage: "register",
              full_name, phone, email
            });
          }
          res.redirect("/login?message=Registration successful! Please login.");
        }
      );
    });
  } catch (error) {
    res.render("register", { 
      message: "System error during registration. Please try again.",
      currentPage: "register",
      full_name, phone, email
    });
  }
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  const message = req.query.message;
  res.render("login", { message, currentPage: "login" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render("login", { 
      message: "Email and password are required",
      currentPage: "login"
    });
  }

  db.query("SELECT * FROM Customer WHERE email = ?", [email], async (err, results) => {
    if (err) {
      return res.render("login", { 
        message: "System error. Please try again.",
        currentPage: "login"
      });
    }
    
    if (results.length === 0) {
      return res.render("login", { 
        message: "Invalid email or password",
        currentPage: "login"
      });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.render("login", { 
        message: "Invalid email or password",
        currentPage: "login"
      });
    }

    req.session.user = {
      id: user.customer_id,
      username: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role || 'customer'
    };

    if (user.role === 'admin' || user.role === 'operator') {
      res.redirect("/admin/dashboard");
    } else {
      res.redirect("/user/dashboard");
    }
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login?message=Logged out successfully");
  });
});

// ===== Dashboard Routes =====
app.get("/dashboard", requireAuth, (req, res) => {
  // Redirect to appropriate dashboard based on role
  if (req.session.user.role === 'admin' || req.session.user.role === 'operator') {
    return res.redirect("/admin/dashboard");
  } else {
    return res.redirect("/user/dashboard");
  }
});

// User Dashboard
app.get("/user/dashboard", requireAuth, (req, res) => {
  if (req.session.user.role === 'admin' || req.session.user.role === 'operator') {
    return res.redirect("/admin/dashboard");
  }

  const userId = req.session.user.id;
  const stats = {};
  
  db.query("SELECT COUNT(*) AS total FROM Vehicle WHERE customer_id = ?", [userId], (err, vehicleResults) => {
    stats.totalVehicles = err ? 0 : vehicleResults[0].total;

    db.query(`
      SELECT COUNT(*) AS total 
      FROM ParkingSession ps 
      JOIN Vehicle v ON ps.vehicle_id = v.vehicle_id 
      WHERE v.customer_id = ? AND ps.exit_time IS NULL
    `, [userId], (err, sessionResults) => {
      stats.activeSessions = err ? 0 : sessionResults[0].total;

      db.query(`
        SELECT COUNT(*) AS total 
        FROM Reservation 
        WHERE customer_id = ? AND start_time > NOW()
      `, [userId], (err, reservationResults) => {
        stats.upcomingReservations = err ? 0 : reservationResults[0].total;

        db.query(`
          SELECT ps.*, v.license_plate, ps2.slot_number
          FROM ParkingSession ps
          JOIN Vehicle v ON ps.vehicle_id = v.vehicle_id
          JOIN ParkingSlot ps2 ON ps.slot_id = ps2.slot_id
          WHERE v.customer_id = ?
          ORDER BY ps.entry_time DESC
          LIMIT 5
        `, [userId], (err, recentSessions) => {
          const recentActivity = err ? [] : recentSessions;

          res.render("user/dashboard", {
            currentPage: "dashboard",
            stats,
            recentActivity,
            recentSessions: recentActivity,
            isCustomer: true
          });
        });
      });
    });
  });
});

// Admin Dashboard
app.get("/admin/dashboard", requireRole(['admin', 'operator']), (req, res) => {
  const userRole = req.session.user.role;
  const stats = {};

  const customerQuery = userRole === 'admin' 
    ? "SELECT COUNT(*) AS total FROM Customer"
    : "SELECT COUNT(*) AS total FROM Customer WHERE role = 'customer'";

  db.query(customerQuery, (err, customerResults) => {
    stats.totalCustomers = err ? 0 : customerResults[0].total;

    db.query("SELECT COUNT(*) AS total FROM Vehicle", (err, vehicleResults) => {
      stats.totalVehicles = err ? 0 : vehicleResults[0].total;

      db.query("SELECT COUNT(*) AS total FROM ParkingSlot WHERE is_occupied = FALSE", (err, slotResults) => {
        stats.availableSlots = err ? 0 : slotResults[0].total;

        db.query("SELECT COUNT(*) AS total FROM ParkingSession WHERE exit_time IS NULL", (err, sessionResults) => {
          stats.activeSessions = err ? 0 : sessionResults[0].total;

          const revenueQuery = "SELECT IFNULL(SUM(total_fee), 0) AS total FROM ParkingSession WHERE DATE(exit_time) = CURDATE()";
          db.query(revenueQuery, (err, revenueResults) => {
            stats.todayRevenue = err ? 0 : revenueResults[0].total;

            db.query("SELECT COUNT(*) AS total FROM ParkingSlot", (err, totalSlotResults) => {
              stats.totalSlots = err ? 0 : totalSlotResults[0].total;

              const activityQuery = `
                SELECT ps.*, v.license_plate, ps2.slot_number, c.full_name AS customer_name
                FROM ParkingSession ps
                JOIN Vehicle v ON ps.vehicle_id = v.vehicle_id
                JOIN ParkingSlot ps2 ON ps.slot_id = ps2.slot_id
                JOIN Customer c ON v.customer_id = c.customer_id
                ORDER BY ps.entry_time DESC
                LIMIT 8
              `;

              db.query(activityQuery, (err, recentActivity) => {
                res.render("admin/dashboard", {
                  currentPage: "dashboard",
                  stats,
                  recentActivity: err ? [] : recentActivity,
                  userRole
                });
              });
            });
          });
        });
      });
    });
  });
});

// ===== Management Routes =====

// Vehicles - Admin view
app.get("/admin/vehicles", requireRole(['admin', 'operator']), (req, res) => {
  const query = `
    SELECT v.*, c.full_name AS customer_name 
    FROM Vehicle v 
    LEFT JOIN Customer c ON v.customer_id = c.customer_id
    ORDER BY v.vehicle_id DESC
  `;

  db.query(query, (err, vehicles) => {
    db.query("SELECT customer_id, full_name FROM Customer WHERE role = 'customer'", (err2, customerResults) => {
      res.render("admin/vehicles", { 
        vehicles: err ? [] : vehicles, 
        customers: err2 ? [] : customerResults,
        currentPage: "vehicles",
        success: req.query.success,
        error: req.query.error
      });
    });
  });
});

// Vehicles - User view
app.get("/user/vehicles", requireAuth, (req, res) => {
  const query = `
    SELECT v.*, c.full_name AS customer_name 
    FROM Vehicle v 
    LEFT JOIN Customer c ON v.customer_id = c.customer_id
    WHERE v.customer_id = ?
    ORDER BY v.vehicle_id DESC
  `;

  db.query(query, [req.session.user.id], (err, vehicles) => {
    res.render("user/vehicles", { 
      vehicles: err ? [] : vehicles, 
      customers: [],
      currentPage: "vehicles",
      success: req.query.success,
      error: req.query.error
    });
  });
});

app.post("/vehicles/add", requireAuth, (req, res) => {
  const { license_plate, type, customer_id, set_as_default } = req.body;
  const finalCustomerId = req.session.user.role === 'customer' ? req.session.user.id : customer_id;
  
  console.log("Adding vehicle:", { license_plate, type, finalCustomerId, set_as_default });
  
  if (!license_plate || !type) {
    const redirectPath = req.session.user.role === 'customer' ? "/user/vehicles?error=missing_fields" : "/admin/vehicles?error=missing_fields";
    return res.redirect(redirectPath);
  }

  // First, check if vehicle already exists for this customer
  const checkQuery = "SELECT * FROM Vehicle WHERE license_plate = ? AND customer_id = ?";
  db.query(checkQuery, [license_plate.toUpperCase(), finalCustomerId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      const redirectPath = req.session.user.role === 'customer' ? '/user/vehicles' : '/admin/vehicles';
      return res.redirect(`${redirectPath}?error=vehicle_add_failed`);
    }
    
    if (results.length > 0) {
      const redirectPath = req.session.user.role === 'customer' ? '/user/vehicles' : '/admin/vehicles';
      return res.redirect(`${redirectPath}?error=duplicate_plate`);
    }

    // If setting as default, first unset any existing default vehicles
    if (set_as_default === '1') {
      db.query(
        "UPDATE Vehicle SET is_default = FALSE WHERE customer_id = ?",
        [finalCustomerId],
        (err) => {
          if (err) console.error("Error unsetting default:", err);
          // Continue with insertion regardless of update result
        }
      );
    }

    // Insert the new vehicle
    const insertQuery = `
      INSERT INTO Vehicle (license_plate, type, customer_id, is_default, created_at) 
      VALUES (?, ?, ?, ?, NOW())
    `;
    const isDefault = set_as_default === '1' ? 1 : 0;
    
    db.query(
      insertQuery,
      [license_plate.toUpperCase(), type, finalCustomerId, isDefault],
      (err, result) => {
        if (err) {
          console.error("Error adding vehicle:", err);
          const redirectPath = req.session.user.role === 'customer' ? '/user/vehicles' : '/admin/vehicles';
          return res.redirect(`${redirectPath}?error=vehicle_add_failed`);
        }
        
        console.log("Vehicle added successfully, ID:", result.insertId);
        const redirectPath = req.session.user.role === 'customer' ? '/user/vehicles' : '/admin/vehicles';
        res.redirect(`${redirectPath}?success=vehicle_added`);
      }
    );
  });
});

app.post("/vehicles/delete/:id", requireAuth, (req, res) => {
  const vehicleId = req.params.id;
  
  let query = "DELETE FROM Vehicle WHERE vehicle_id = ?";
  const queryParams = [vehicleId];
  
  if (req.session.user.role === 'customer') {
    query += " AND customer_id = ?";
    queryParams.push(req.session.user.id);
  }

  db.query(query, queryParams, (err) => {
    const redirectPath = req.session.user.role === 'customer' ? '/user/vehicles' : '/admin/vehicles';
    res.redirect(`${redirectPath}?${err ? 'error=delete_failed' : 'success=vehicle_deleted'}`);
  });
});

// Set default vehicle route
app.post("/vehicles/set-default/:id", requireAuth, (req, res) => {
  const vehicleId = req.params.id;
  const userId = req.session.user.id;

  db.beginTransaction((err) => {
    if (err) {
      return res.redirect('/user/vehicles?error=update_failed');
    }

    // First, unset all default vehicles for this user
    db.query(
      "UPDATE Vehicle SET is_default = FALSE WHERE customer_id = ?",
      [userId],
      (err) => {
        if (err) {
          return db.rollback(() => {
            res.redirect('/user/vehicles?error=update_failed');
          });
        }

        // Then set the selected vehicle as default
        db.query(
          "UPDATE Vehicle SET is_default = TRUE WHERE vehicle_id = ? AND customer_id = ?",
          [vehicleId, userId],
          (err, result) => {
            if (err || result.affectedRows === 0) {
              return db.rollback(() => {
                res.redirect('/user/vehicles?error=update_failed');
              });
            }

            db.commit((err) => {
              if (err) {
                return db.rollback(() => {
                  res.redirect('/user/vehicles?error=update_failed');
                });
              }
              res.redirect('/user/vehicles?success=vehicle_updated');
            });
          }
        );
      }
    );
  });
});

// Slots - Admin only
app.get("/admin/slots", requireRole(['admin', 'operator']), (req, res) => {
  db.query(`
    SELECT ps.*, 
           (SELECT license_plate FROM Vehicle v 
            JOIN ParkingSession pss ON v.vehicle_id = pss.vehicle_id 
            WHERE pss.slot_id = ps.slot_id AND pss.exit_time IS NULL) as current_vehicle
    FROM ParkingSlot ps 
    ORDER BY ps.slot_number
  `, (err, slots) => {
    res.render("admin/slots", { 
      slots: err ? [] : slots,
      currentPage: "slots",
      success: req.query.success,
      error: req.query.error
    });
  });
});

app.post("/slots/update/:id", requireRole(['admin', 'operator']), (req, res) => {
  const slotId = req.params.id;
  const { is_occupied, maintenance_mode } = req.body;

  // Check if maintenance_mode column exists before using it
  const updateQuery = maintenance_mode !== undefined 
    ? "UPDATE ParkingSlot SET is_occupied = ?, maintenance_mode = ? WHERE slot_id = ?"
    : "UPDATE ParkingSlot SET is_occupied = ? WHERE slot_id = ?";
  
  const queryParams = maintenance_mode !== undefined 
    ? [is_occupied ? 1 : 0, maintenance_mode ? 1 : 0, slotId]
    : [is_occupied ? 1 : 0, slotId];

  db.query(updateQuery, queryParams, (err) => {
    res.redirect(`/admin/slots?${err ? 'error=update_failed' : 'success=slot_updated'}`);
  });
});

// Sessions - Admin only
app.get("/admin/sessions", requireRole(['admin', 'operator']), (req, res) => {
  db.query(`
    SELECT ps.*, v.license_plate, c.full_name as customer_name, p.slot_number
    FROM ParkingSession ps
    JOIN Vehicle v ON ps.vehicle_id = v.vehicle_id
    JOIN Customer c ON v.customer_id = c.customer_id
    JOIN ParkingSlot p ON ps.slot_id = p.slot_id
    WHERE ps.exit_time IS NULL
    ORDER BY ps.entry_time DESC
  `, (err, activeSessions) => {
    db.query(`
      SELECT v.vehicle_id, v.license_plate, c.full_name as customer_name
      FROM Vehicle v
      JOIN Customer c ON v.customer_id = c.customer_id
      WHERE v.vehicle_id NOT IN (
        SELECT vehicle_id FROM ParkingSession WHERE exit_time IS NULL
      )
    `, (err, availableVehicles) => {
      // FIXED: Remove maintenance_mode condition since column doesn't exist
      db.query(`
        SELECT * FROM ParkingSlot 
        WHERE is_occupied = FALSE
      `, (err, availableSlots) => {
        res.render("admin/sessions", {
          activeSessions: err ? [] : activeSessions,
          availableVehicles: err ? [] : availableVehicles,
          availableSlots: err ? [] : availableSlots,
          currentPage: "sessions",
          success: req.query.success,
          error: req.query.error
        });
      });
    });
  });
});

app.post("/sessions/start", requireRole(['admin', 'operator']), (req, res) => {
  const { vehicle_id, slot_id } = req.body;

  if (!vehicle_id || !slot_id) {
    return res.redirect("/admin/sessions?error=missing_fields");
  }

  db.beginTransaction((err) => {
    if (err) return res.redirect("/admin/sessions?error=session_start_failed");

    db.query(
      "INSERT INTO ParkingSession (vehicle_id, slot_id, entry_time) VALUES (?, ?, NOW())",
      [vehicle_id, slot_id],
      (err) => {
        if (err) return db.rollback(() => res.redirect("/admin/sessions?error=session_start_failed"));

        db.query(
          "UPDATE ParkingSlot SET is_occupied = TRUE WHERE slot_id = ?",
          [slot_id],
          (err) => {
            if (err) return db.rollback(() => res.redirect("/admin/sessions?error=session_start_failed"));
            db.commit((err) => {
              res.redirect(`/admin/sessions?${err ? 'error=session_start_failed' : 'success=session_started'}`);
            });
          }
        );
      }
    );
  });
});

app.post("/sessions/end/:id", requireRole(['admin', 'operator']), (req, res) => {
  const sessionId = req.params.id;

  db.beginTransaction((err) => {
    if (err) return res.redirect("/admin/sessions?error=session_end_failed");

    db.query(`
      UPDATE ParkingSession 
      SET exit_time = NOW(), 
          total_fee = TIMESTAMPDIFF(HOUR, entry_time, NOW()) * 100 
      WHERE session_id = ? AND exit_time IS NULL
    `, [sessionId], (err, result) => {
      if (err || result.affectedRows === 0) {
        return db.rollback(() => res.redirect("/admin/sessions?error=session_end_failed"));
      }

      db.query("SELECT slot_id FROM ParkingSession WHERE session_id = ?", [sessionId], (err, results) => {
        if (err || results.length === 0) {
          return db.rollback(() => res.redirect("/admin/sessions?error=session_end_failed"));
        }

        const slotId = results[0].slot_id;
        db.query(
          "UPDATE ParkingSlot SET is_occupied = FALSE WHERE slot_id = ?",
          [slotId],
          (err) => {
            if (err) return db.rollback(() => res.redirect("/admin/sessions?error=session_end_failed"));
            db.commit((err) => {
              res.redirect(`/admin/sessions?${err ? 'error=session_end_failed' : 'success=session_ended'}`);
            });
          }
        );
      });
    });
  });
});

// User Sessions - View user's parking sessions
app.get("/user/sessions", requireAuth, (req, res) => {
  if (req.session.user.role === 'admin' || req.session.user.role === 'operator') {
    return res.redirect("/admin/sessions");
  }

  const userId = req.session.user.id;
  
  // Get user's parking sessions (both active and completed)
  const query = `
    SELECT 
      ps.*, 
      v.license_plate, 
      ps2.slot_number,
      CASE 
        WHEN ps.exit_time IS NULL THEN 'Active'
        ELSE 'Completed'
      END as status,
      TIMESTAMPDIFF(MINUTE, ps.entry_time, COALESCE(ps.exit_time, NOW())) as duration_minutes,
      ps.total_fee
    FROM ParkingSession ps
    JOIN Vehicle v ON ps.vehicle_id = v.vehicle_id
    JOIN ParkingSlot ps2 ON ps.slot_id = ps2.slot_id
    WHERE v.customer_id = ?
    ORDER BY ps.entry_time DESC
  `;

  db.query(query, [userId], (err, sessions) => {
    if (err) {
      console.error("Database error:", err);
      return res.render("user/sessions", {
        sessions: [],
        currentPage: "sessions",
        success: req.query.success,
        error: req.query.error
      });
    }

    // Calculate stats
    const stats = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'Active').length,
      totalSpent: sessions.reduce((sum, session) => sum + (session.total_fee || 0), 0)
    };

    res.render("user/sessions", {
      sessions: sessions || [],
      stats: stats,
      currentPage: "sessions",
      success: req.query.success,
      error: req.query.error
    });
  });
});

// Reservations - Admin view
app.get("/admin/reservations", requireRole(['admin', 'operator']), (req, res) => {
  const query = `
    SELECT r.*, c.full_name AS customer_name, v.license_plate, ps.slot_number
    FROM Reservation r
    JOIN Customer c ON r.customer_id = c.customer_id
    JOIN Vehicle v ON r.vehicle_id = v.vehicle_id
    JOIN ParkingSlot ps ON r.slot_id = ps.slot_id
    ORDER BY r.start_time DESC
  `;

  db.query(query, (err, reservations) => {
    if (err) {
      console.error("Database error:", err);
      return res.render("admin/reservations", {
        reservations: [],
        vehicles: [],
        slots: [],
        customers: [],
        currentPage: "reservations",
        success: req.query.success,
        error: req.query.error
      });
    }

    const vehiclesQuery = "SELECT vehicle_id, license_plate FROM Vehicle";
    // FIXED: Remove maintenance_mode condition
    const slotsQuery = "SELECT slot_id, slot_number FROM ParkingSlot";
    const customersQuery = "SELECT customer_id, full_name FROM Customer WHERE role = 'customer'";

    db.query(vehiclesQuery, (err, vehicles) => {
      if (err) {
        console.error("Vehicles query error:", err);
        vehicles = [];
      }

      db.query(slotsQuery, (err, slots) => {
        if (err) {
          console.error("Slots query error:", err);
          slots = [];
        }

        db.query(customersQuery, (err, customerResults) => {
          if (err) {
            console.error("Customers query error:", err);
            customerResults = [];
          }

          res.render("admin/reservations", {
            reservations: reservations || [],
            vehicles: vehicles || [],
            slots: slots || [],
            customers: customerResults || [],
            currentPage: "reservations",
            success: req.query.success,
            error: req.query.error
          });
        });
      });
    });
  });
});

// Reservations - User view
app.get("/user/reservations", requireAuth, (req, res) => {
  const query = `
    SELECT r.*, c.full_name AS customer_name, v.license_plate, ps.slot_number
    FROM Reservation r
    JOIN Customer c ON r.customer_id = c.customer_id
    JOIN Vehicle v ON r.vehicle_id = v.vehicle_id
    JOIN ParkingSlot ps ON r.slot_id = ps.slot_id
    WHERE r.customer_id = ?
    ORDER BY r.start_time DESC
  `;

  db.query(query, [req.session.user.id], (err, reservations) => {
    const vehiclesQuery = "SELECT vehicle_id, license_plate FROM Vehicle WHERE customer_id = ?";
    // FIXED: Remove maintenance_mode condition
    const slotsQuery = "SELECT slot_id, slot_number FROM ParkingSlot";

    db.query(vehiclesQuery, [req.session.user.id], (err, vehicles) => {
      db.query(slotsQuery, (err, slots) => {
        res.render("user/reservations", {
          reservations: err ? [] : reservations,
          vehicles: err ? [] : vehicles,
          slots: err ? [] : slots,
          customers: [],
          currentPage: "reservations",
          success: req.query.success,
          error: req.query.error
        });
      });
    });
  });
});

app.post("/reservations/add", requireAuth, (req, res) => {
  const { vehicle_id, slot_id, start_time, end_time, customer_id } = req.body;
  const finalCustomerId = req.session.user.role === 'customer' ? req.session.user.id : customer_id;

  if (!vehicle_id || !slot_id || !start_time || !end_time) {
    const redirectPath = req.session.user.role === 'customer' ? '/user/reservations' : '/admin/reservations';
    return res.redirect(`${redirectPath}?error=missing_fields`);
  }

  db.query(
    "INSERT INTO Reservation (customer_id, vehicle_id, slot_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
    [finalCustomerId, vehicle_id, slot_id, start_time, end_time],
    (err) => {
      const error = err ? (err.code === 'ER_DUP_ENTRY' ? 'duplicate_reservation' : 'reservation_failed') : null;
      const redirectPath = req.session.user.role === 'customer' ? '/user/reservations' : '/admin/reservations';
      res.redirect(`${redirectPath}?${error ? 'error=' + error : 'success=reservation_created'}`);
    }
  );
});

// Customers - Admin only
app.get("/admin/customers", requireRole(['admin']), (req, res) => {
  db.query("SELECT * FROM Customer ORDER BY registered_at DESC", (err, customers) => {
    res.render("admin/customers", { 
      customers: err ? [] : customers,
      currentPage: "customers",
      success: req.query.success,
      error: req.query.error
    });
  });
});

app.post("/customers/update-role/:id", requireRole(['admin']), (req, res) => {
  const customerId = req.params.id;
  const { role } = req.body;

  if (!['customer', 'operator', 'admin'].includes(role)) {
    return res.redirect("/admin/customers?error=invalid_role");
  }

  db.query(
    "UPDATE Customer SET role = ? WHERE customer_id = ?",
    [role, customerId],
    (err) => {
      res.redirect(`/admin/customers?${err ? 'error=role_update_failed' : 'success=role_updated'}`);
    }
  );
});

// Profile - User
app.get("/user/profile", requireAuth, (req, res) => {
  res.render("user/profile", { 
    currentPage: "profile",
    success: req.query.success,
    error: req.query.error
  });
});

app.post("/profile/update", requireAuth, (req, res) => {
  const { full_name, phone, email } = req.body;
  const userId = req.session.user.id;

  if (!full_name || !phone || !email) {
    return res.redirect("/user/profile?error=missing_fields");
  }

  db.query(
    "UPDATE Customer SET full_name = ?, phone = ?, email = ? WHERE customer_id = ?",
    [full_name, phone, email, userId],
    (err) => {
      if (!err) {
        req.session.user.username = full_name;
        req.session.user.email = email;
        req.session.user.phone = phone;
      }
      const error = err ? (err.code === 'ER_DUP_ENTRY' ? 'duplicate_email' : 'update_failed') : null;
      res.redirect(`/user/profile?${error ? 'error=' + error : 'success=profile_updated'}`);
    }
  );
});

app.post("/profile/change-password", requireAuth, async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const userId = req.session.user.id;

  if (!current_password || !new_password || !confirm_password) {
    return res.redirect("/user/profile?error=missing_fields");
  }

  if (new_password !== confirm_password) {
    return res.redirect("/user/profile?error=password_mismatch");
  }

  if (new_password.length < 8) {
    return res.redirect("/user/profile?error=password_too_short");
  }

  db.query("SELECT password FROM Customer WHERE customer_id = ?", [userId], async (err, results) => {
    if (err || results.length === 0) {
      return res.redirect("/user/profile?error=verification_failed");
    }

    const match = await bcrypt.compare(current_password, results[0].password);
    if (!match) {
      return res.redirect("/user/profile?error=incorrect_password");
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    db.query(
      "UPDATE Customer SET password = ? WHERE customer_id = ?",
      [hashedPassword, userId],
      (err) => {
        res.redirect(`/user/profile?${err ? 'error=password_update_failed' : 'success=password_updated'}`);
      }
    );
  });
});

// ===== Legacy Route Redirects =====

// Redirect legacy admin routes to new admin routes
app.get("/admin", requireRole(['admin', 'operator']), (req, res) => {
  res.redirect("/admin/dashboard");
});

app.get("/vehicles", requireAuth, (req, res) => {
  if (req.session.user.role === 'admin' || req.session.user.role === 'operator') {
    res.redirect("/admin/vehicles");
  } else {
    res.redirect("/user/vehicles");
  }
});

app.get("/reservations", requireAuth, (req, res) => {
  if (req.session.user.role === 'admin' || req.session.user.role === 'operator') {
    res.redirect("/admin/reservations");
  } else {
    res.redirect("/user/reservations");
  }
});

app.get("/sessions", requireAuth, (req, res) => {
  if (req.session.user.role === 'admin' || req.session.user.role === 'operator') {
    res.redirect("/admin/sessions");
  } else {
    res.redirect("/user/dashboard");
  }
});

app.get("/slots", requireAuth, (req, res) => {
  if (req.session.user.role === 'admin' || req.session.user.role === 'operator') {
    res.redirect("/admin/slots");
  } else {
    res.redirect("/user/dashboard");
  }
});

app.get("/customers", requireAuth, (req, res) => {
  if (req.session.user.role === 'admin') {
    res.redirect("/admin/customers");
  } else {
    res.redirect("/user/dashboard");
  }
});

// Add Slot Route - UPDATED
app.post('/slots/add', requireRole(['admin', 'operator']), (req, res) => {
    const { slot_number, slot_type, slot_location, initial_status, slot_notes } = req.body;
    
    console.log('Adding new slot:', req.body);
    
    if (!slot_number) {
        return res.redirect('/admin/slots?error=Slot number is required');
    }

    // Map the slot_type to match your enum values
    let mappedSlotType = 'Compact';
    if (slot_type === 'compact') mappedSlotType = 'Compact';
    else if (slot_type === 'large') mappedSlotType = 'Large';
    else if (slot_type === 'motorcycle') mappedSlotType = 'Motorcycle';
    else if (slot_type === 'standard') mappedSlotType = 'Compact';
    else if (slot_type === 'handicap') mappedSlotType = 'Large';
    else if (slot_type === 'electric') mappedSlotType = 'Large';

    // Determine initial status - handle maintenance mode if column exists
    const is_occupied = initial_status === 'occupied' ? 1 : 0;

    // Check if slot number already exists
    db.query('SELECT * FROM ParkingSlot WHERE slot_number = ?', [slot_number], (err, results) => {
        if (err) {
            console.error('Error checking existing slot:', err);
            return res.redirect('/admin/slots?error=Database error');
        }

        if (results.length > 0) {
            return res.redirect('/admin/slots?error=Slot number ' + slot_number + ' already exists');
        }

        // Insert new slot - only include maintenance_mode if the column exists
        const insertQuery = `
            INSERT INTO ParkingSlot (slot_number, slot_type, is_occupied) 
            VALUES (?, ?, ?)
        `;
        
        db.query(
            insertQuery,
            [slot_number, mappedSlotType, is_occupied],
            (err, result) => {
                if (err) {
                    console.error('Error inserting slot:', err);
                    return res.redirect('/admin/slots?error=Failed to add slot: ' + err.message);
                }

                console.log('✅ Slot added successfully, ID:', result.insertId);
                res.redirect('/admin/slots?success=Slot ' + slot_number + ' added successfully!');
            }
        );
    });
});

// ===== Error Handling =====
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  const statusCode = err.status || 500;
  let message = "Something went wrong! Please try again later.";
  
  if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage.includes('maintenance_mode')) {
    message = "Database configuration error. Please contact administrator.";
  } else if (err.code === 'ER_DUP_ENTRY') {
    message = "Duplicate entry found.";
  } else if (err.code === 'ER_NO_REFERENCED_ROW') {
    message = "Referenced record not found.";
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    message = "Database access denied.";
  }
  
  res.status(statusCode).render("error", { message, status: statusCode });
});

app.use((req, res) => {
  res.status(404).render("error", {
    message: "The page you are looking for does not exist.",
    status: 404
  });
});

// ===== Server Start =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`👤 Test Admin: admin@example.com / admin123`);
  console.log(`👥 Test Operator: operator@example.com / operator123`);
});