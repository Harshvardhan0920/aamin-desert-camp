const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();

// ==========================================
// 1. MIDDLEWARES (50MB Limit for Base64 Images)
// ==========================================
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// 2. DATABASE CONNECTION (Permanent Storage)
// ==========================================
// Tumhara MongoDB link (Database name 'AaminDesertCamp' add kiya hai)
const MONGO_URI = "mongodb+srv://admin:AaminDesert@cluster0.ptckt1u.mongodb.net/AaminDesertCamp?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully! (Data is Permanent)"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err.message));

// ==========================================
// 3. EMAIL SETUP (NODEMAILER)
// ==========================================
const ADMIN_EMAIL = 'aamindesertcamp@gmail.com';
const APP_PASSWORD = 'uwesvbqlpbimgtaw'; // App Password bina space ke

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: ADMIN_EMAIL, pass: APP_PASSWORD }
});

// ==========================================
// 4. MULTER (MEMORY STORAGE) - ✨ PHOTO GAYAB HONE KA FIX ✨
// ==========================================
// Ab images disk (uploads folder) par nahi, seedha Memory se Database mein jayengi
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 15 * 1024 * 1024 } }); // 15MB Limit per photo

// ==========================================
// 5. DATABASE SCHEMAS
// ==========================================
const GalleryModel = mongoose.model('Gallery', new mongoose.Schema({ image: String }));
const RoomModel = mongoose.model('Room', new mongoose.Schema({ name: String, price: Number, description: String, image: String }));
const BookingModel = mongoose.model('Booking', new mongoose.Schema({ 
    name: String, email: String, phone: String, tentType: String, 
    guests: Number, checkInDate: Date, checkOutDate: Date, 
    status: { type: String, default: 'Pending' } 
}, { timestamps: true }));
const ContactModel = mongoose.model('Contact', new mongoose.Schema({ name: String, email: String, subject: String, message: String, date: { type: Date, default: Date.now } }));
const ReviewModel = mongoose.model('Review', new mongoose.Schema({ guestName: String, comment: String, rating: Number, adminReply: String, createdAt: { type: Date, default: Date.now } }));

// ==========================================
// 6. API ROUTES
// ==========================================

// --- ADMIN LOGIN ---
app.post('/api/admin/login', (req, res) => {
    if (req.body.username === "admin" && req.body.password === "admin123") res.status(200).json({ message: "Login successful!" });
    else res.status(401).json({ error: "Invalid credentials" });
});

// --- STATS (DASHBOARD & BOOKING) ---
app.get('/api/stats', async (req, res) => {
    try {
        const confirmedBookings = await BookingModel.countDocuments({ status: 'Confirmed' });
        res.json({ availableTents: Math.max(0, 15 - confirmedBookings) });
    } catch (e) { res.status(500).json({ error: "Server Error", availableTents: 5 }); }
});

// --- GALLERY API (Now using Base64 directly to DB) ---
app.get('/api/gallery', async (req, res) => res.json(await GalleryModel.find().sort({_id: -1})));

app.post('/api/gallery', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        // Image ko Base64 String banakar save kar rahe hain
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        await GalleryModel.create({ image: base64Image });
        res.status(201).json({ message: "Photo added" });
    } catch (e) { res.status(500).json({ error: "Upload failed" }); }
});

app.put('/api/gallery/:id', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        await GalleryModel.findByIdAndUpdate(req.params.id, { image: base64Image });
        res.json({ message: "Photo updated" });
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/gallery/:id', async (req, res) => {
    try {
        await GalleryModel.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

// --- ROOMS API (Base64 DB Storage) ---
app.get('/api/rooms', async (req, res) => res.json(await RoomModel.find().sort({_id: -1})));

app.post('/api/rooms', upload.single('image'), async (req, res) => {
    try {
        const { name, price, description } = req.body;
        let base64Image = '';
        if (req.file) {
            base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }
        await RoomModel.create({ name, price, description, image: base64Image });
        res.status(201).json({ message: "Room added" });
    } catch (e) { res.status(500).json({ error: "Error adding room" }); }
});

app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {
    try {
        let updateData = { name: req.body.name, price: req.body.price, description: req.body.description };
        if (req.file) {
            updateData.image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }
        await RoomModel.findByIdAndUpdate(req.params.id, updateData);
        res.json({ message: "Updated" });
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/rooms/:id', async (req, res) => {
    try {
        await RoomModel.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

// --- BOOKINGS API (With Auto-Emails) ---
app.get('/api/bookings', async (req, res) => res.json(await BookingModel.find().sort({createdAt: -1})));

app.post('/api/bookings', async (req, res) => {
    try {
        const adults = parseInt(req.body.adults) || 0;
        const children = parseInt(req.body.children) || 0;
        
        const bookingData = {
            name: req.body.guestName, email: req.body.email, phone: req.body.phone, tentType: req.body.roomType,
            checkInDate: req.body.checkIn, checkOutDate: req.body.checkOut,
            guests: adults + children, status: 'Pending'
        };
        await BookingModel.create(bookingData);

        // Notify Admin (Tumhe aayega)
        const adminMail = {
            from: `"Aamin Camp Portal" <${ADMIN_EMAIL}>`, to: ADMIN_EMAIL,
            subject: `🚨 NEW BOOKING: ${bookingData.name} - ${bookingData.tentType}`,
            html: `<h3>New Booking Request!</h3><p><b>Name:</b> ${bookingData.name}</p><p><b>Phone:</b> ${bookingData.phone}</p><p><b>Email:</b> ${bookingData.email}</p><p><b>Tent:</b> ${bookingData.tentType}</p><p><b>Dates:</b> ${bookingData.checkInDate} to ${bookingData.checkOutDate}</p><p><b>Guests:</b> ${bookingData.guests}</p>`
        };

        // Notify Customer (Guest ko jayega)
        const customerMail = {
            from: `"Aamin Desert Camp" <${ADMIN_EMAIL}>`, to: bookingData.email,
            subject: '🏕️ Booking Request Received',
            html: `<h3>Dear ${bookingData.name},</h3><p>Thank you for choosing Aamin Desert Camp!</p><p>We received your booking for the <b>${bookingData.tentType}</b> from ${bookingData.checkInDate} to ${bookingData.checkOutDate}.</p><p>Our team will contact you shortly to confirm your reservation.</p><p>Regards,<br>Aamin Desert Camp Team</p>`
        };

        transporter.sendMail(adminMail).catch(e => console.log("Admin email error:", e));
        transporter.sendMail(customerMail).catch(e => console.log("Customer email error:", e));

        res.status(201).json({ message: "Booking saved" });
    } catch (e) { res.status(500).json({ error: "Save failed" }); }
});

app.put('/api/bookings/:id/status', async (req, res) => {
    await BookingModel.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ message: "Status updated" });
});
app.delete('/api/bookings/:id', async (req, res) => {
    await BookingModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// --- CONTACT MESSAGES API (With Auto-Email to Admin) ---
app.post('/api/contact', async (req, res) => {
    try {
        await ContactModel.create(req.body);
        transporter.sendMail({
            from: `"Website Contact" <${ADMIN_EMAIL}>`, to: ADMIN_EMAIL,
            subject: `✉️ New Inquiry from ${req.body.name}`,
            text: `Name: ${req.body.name}\nEmail: ${req.body.email}\nSubject: ${req.body.subject}\n\nMessage:\n${req.body.message}`
        }).catch(e => console.log("Contact email error:", e));
        res.status(201).json({ message: "Message sent" });
    } catch (e) { res.status(500).json({ error: "Error sending message" }); }
});
app.get('/api/messages', async (req, res) => res.json(await ContactModel.find().sort({date: -1})));
app.put('/api/messages/:id', async (req, res) => {
    await ContactModel.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: "Updated" });
});
app.delete('/api/messages/:id', async (req, res) => {
    await ContactModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// --- REVIEWS API ---
app.get('/api/reviews', async (req, res) => res.json(await ReviewModel.find().sort({createdAt: -1})));
app.post('/api/reviews', async (req, res) => {
    try {
        await ReviewModel.create({ guestName: req.body.name, comment: req.body.text, rating: req.body.rating, adminReply: req.body.adminReply || "" });
        res.status(201).json({ message: "Review added" });
    } catch (e) { res.status(500).json({ error: "Error adding review" }); }
});
app.put('/api/reviews/:id', async (req, res) => {
    await ReviewModel.findByIdAndUpdate(req.params.id, { guestName: req.body.name, comment: req.body.text, rating: req.body.rating, adminReply: req.body.adminReply });
    res.json({ message: "Updated" });
});
app.delete('/api/reviews/:id', async (req, res) => {
    await ReviewModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// ==========================================
// 7. SERVER STARTUP
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Desert Camp Server is running flawlessly on port ${PORT}`);
});