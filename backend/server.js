const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// 1. APP CONFIGURATION
// ==========================================
const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Badi images handle karne ke liye
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static Files Setup
// Yeh lines frontend files aur uploaded images ko public karti hain
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 2. DATABASE CONNECTION
// ==========================================
// 🛑 IMPORTANT: Yahan apni asli MongoDB Atlas Connection String daalna 🛑
const MONGO_URI = "mongodb+srv://admin:AaminDesert@cluster0.ptckt1u.mongodb.net/?appName=Cluster0"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err.message));

// ==========================================
// 3. MULTER STORAGE SETUP (For Uploading Images)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Unique filename: Timestamp-OriginalName
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 4. DATABASE MODELS (Schemas)
// ==========================================
const GalleryModel = mongoose.model('Gallery', new mongoose.Schema({ image: String }));

const RoomModel = mongoose.model('Room', new mongoose.Schema({ 
    name: String, price: Number, description: String, image: String 
}));

const BookingModel = mongoose.model('Booking', new mongoose.Schema({ 
    name: String, email: String, phone: String, tentType: String, 
    guests: Number, checkInDate: Date, checkOutDate: Date, 
    adults: String, children: String, status: { type: String, default: 'Pending' } 
}, { timestamps: true }));

const ContactModel = mongoose.model('Contact', new mongoose.Schema({ 
    name: String, email: String, subject: String, message: String, 
    date: { type: Date, default: Date.now } 
}));

const ReviewModel = mongoose.model('Review', new mongoose.Schema({ 
    guestName: String, comment: String, rating: Number, adminReply: String, 
    createdAt: { type: Date, default: Date.now } 
}));

// ==========================================
// 5. API ROUTES
// ==========================================

// --- ADMIN LOGIN ---
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin123") {
        res.status(200).json({ message: "Login successful!" });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// --- STATS API (Used by booking.html for Inventory) ---
app.get('/api/stats', async (req, res) => {
    try {
        const confirmedBookings = await BookingModel.countDocuments({ status: 'Confirmed' });
        let totalTentsAvailable = 15 - confirmedBookings; // Assuming 15 total tents
        res.json({ availableTents: Math.max(0, totalTentsAvailable) });
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

// --- GALLERY ---
app.get('/api/gallery', async (req, res) => res.json(await GalleryModel.find().sort({_id: -1})));

app.post('/api/gallery', upload.single('image'), async (req, res) => {
    try {
        const imageUrl = `/uploads/${req.file.filename}`;
        await GalleryModel.create({ image: imageUrl });
        res.status(201).json({ message: "Photo added" });
    } catch (e) { res.status(500).json({ error: "Upload failed" }); }
});

app.delete('/api/gallery/:id', async (req, res) => {
    try {
        const photo = await GalleryModel.findByIdAndDelete(req.params.id);
        if (photo && photo.image) {
            const filePath = path.join(__dirname, photo.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

// --- ROOMS ---
app.get('/api/rooms', async (req, res) => res.json(await RoomModel.find().sort({_id: -1})));

app.post('/api/rooms', upload.single('image'), async (req, res) => {
    try {
        const { name, price, description } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
        await RoomModel.create({ name, price, description, image: imageUrl });
        res.status(201).json({ message: "Room added" });
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {
    try {
        let updateData = { ...req.body };
        if (req.file) updateData.image = `/uploads/${req.file.filename}`;
        await RoomModel.findByIdAndUpdate(req.params.id, updateData);
        res.json({ message: "Updated" });
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/rooms/:id', async (req, res) => {
    try {
        const room = await RoomModel.findByIdAndDelete(req.params.id);
        if (room && room.image) {
            const filePath = path.join(__dirname, room.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

// --- BOOKINGS ---
app.get('/api/bookings', async (req, res) => res.json(await BookingModel.find().sort({createdAt: -1})));

app.post('/api/bookings', async (req, res) => {
    try {
        const data = {
            name: req.body.guestName,
            email: req.body.email,
            phone: req.body.phone,
            tentType: req.body.roomType,
            checkInDate: req.body.checkIn,
            checkOutDate: req.body.checkOut,
            guests: parseInt(req.body.adults || 0) + parseInt(req.body.children || 0),
            status: 'Pending'
        };
        await BookingModel.create(data);
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

// --- CONTACT / MESSAGES ---
app.post('/api/contact', async (req, res) => {
    try {
        await ContactModel.create(req.body);
        res.status(201).json({ message: "Message sent" });
    } catch (e) { res.status(500).json({ error: "Error" }); }
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

// --- REVIEWS ---
app.get('/api/reviews', async (req, res) => res.json(await ReviewModel.find().sort({createdAt: -1})));

app.post('/api/reviews', async (req, res) => {
    try {
        // Admin form fields mapping
        const revData = { 
            guestName: req.body.name, 
            comment: req.body.text, 
            rating: req.body.rating,
            adminReply: req.body.adminReply || ""
        };
        await ReviewModel.create(revData);
        res.status(201).json({ message: "Review added" });
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.put('/api/reviews/:id', async (req, res) => {
    const updateData = {
        guestName: req.body.name,
        comment: req.body.text,
        rating: req.body.rating,
        adminReply: req.body.adminReply
    };
    await ReviewModel.findByIdAndUpdate(req.params.id, updateData);
    res.json({ message: "Updated" });
});

app.delete('/api/reviews/:id', async (req, res) => {
    await ReviewModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// ==========================================
// 6. SERVER START
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server started flawlessly on port ${PORT}`);
});