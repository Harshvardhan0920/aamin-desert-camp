const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
// ... baaki require statements ke niche ye add karo
const nodemailer = require('nodemailer');

// Email Config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'aamindesertcamp@gmail.com', // Yahan apna email dalo
        pass: 'uwes vbql pbim gtaw' // Yahan wo code dalo
    }
});

// ==========================================
// Middleware & Photo Upload Setup
// ==========================================
app.use(cors());
app.use(express.json());

// 'uploads' naam ka folder check karo, nahi hai toh khud bana do
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
// Uploads folder ki photos ko public banao taaki website par dikh sakein
app.use('/uploads', express.static(uploadDir));

// Multer Setup (Photo kahan aur kis naam se save hogi)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// ==========================================
// Database Connection
// ==========================================
mongoose.connect('mongodb://127.0.0.1:27017/aamin_desert_camp').then(() => {
    console.log("✅ Database Connected Successfully!");
}).catch((err) => {
    console.log("❌ Database Connection Failed:", err);
});

// ==========================================
// Database Schemas (Designs)
// ==========================================
const roomSchema = new mongoose.Schema({
    name: String, price: Number, description: String, image: String, status: String
});
const Room = mongoose.model('Room', roomSchema);

const bookingSchema = new mongoose.Schema({
    guestName: String, email: String, phone: String, roomType: String,
    checkIn: Date, checkOut: Date, adults: Number, children: Number,
    status: { type: String, default: 'Pending' },
    bookingDate: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', bookingSchema);

const messageSchema = new mongoose.Schema({
    name: String, email: String, subject: String, message: String,
    date: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// ==========================================
// APIs (Raste)
// ==========================================

// 1. ADD ROOM (With Photo Upload)
app.post('/api/rooms', upload.single('imageFile'), async (req, res) => {
    try {
        const roomData = req.body;
        // Agar photo upload hui hai, toh uska server wala link save karo
        if (req.file) {
            roomData.image = 'http://localhost:5000/uploads/' + req.file.filename;
        }
        const newRoom = new Room(roomData);
        await newRoom.save();
        res.status(201).json({ message: "Room added successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error saving room", error });
    }
});

// 2. GET ROOMS
app.get('/api/rooms', async (req, res) => {
    const rooms = await Room.find();
    res.status(200).json(rooms);
});

// 3. DELETE ROOM
app.delete('/api/rooms/:id', async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Room deleted!" });
});

// 4. BOOKINGS APIs
app.post('/api/bookings', async (req, res) => {
    const newBooking = new Booking(req.body);
    console.log("Database mein aaya hua data:", req.body); // Ye line add karo
    await newBooking.save();

    // --- EMAIL LOGIC YAHA ADD KARO ---
    const mailOptions = {
        from: 'aamindesertcamp@gmail.com', // Apna wahi email dalo jo transporter mein hai
        to: 'harshrathore0100@gmail.com', // Jahan notifications chahiye
        subject: 'New Booking at Aamin Desert Camp!',
        // Is tarah change karo (Example)
text: `Nayi booking details:
Name: ${req.body.fullName} 
Date: ${req.body.bookingDate}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.log("Email error:", error);
        else console.log('Email sent: ' + info.response);
    });
    // --- EMAIL LOGIC KHATAM ---

    res.status(201).json({ message: "Booking saved!" });
});

app.get('/api/bookings', async (req, res) => {
    const bookings = await Booking.find().sort({ bookingDate: -1 });
    res.status(200).json(bookings);
});

app.put('/api/bookings/:id', async (req, res) => {
    const updated = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.status(200).json(updated);
});

app.delete('/api/bookings/:id', async (req, res) => {
    await Booking.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Booking deleted!" });
});
// ==========================================
// 10. Gallery System
// ==========================================

// 1. Gallery Schema
const gallerySchema = new mongoose.Schema({
    image: String,
    title: String,
    date: { type: Date, default: Date.now }
});
const Gallery = mongoose.model('Gallery', gallerySchema);

// 2. Upload Photo to Gallery
app.post('/api/gallery', upload.single('galleryImage'), async (req, res) => {
    try {
        let imageUrl = "";
        if (req.file) {
            imageUrl = 'http://localhost:5000/uploads/' + req.file.filename;
        }
        const newPhoto = new Gallery({
            image: imageUrl,
            title: req.body.title || "Camp Photo"
        });
        await newPhoto.save();
        res.status(201).json({ message: "Photo uploaded to gallery!" });
    } catch (error) {
        res.status(500).json({ error: "Upload failed" });
    }
});

// 3. Get All Gallery Photos
app.get('/api/gallery', async (req, res) => {
    try {
        const photos = await Gallery.find().sort({ date: -1 });
        res.status(200).json(photos);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

// 4. Delete Gallery Photo
app.delete('/api/gallery/:id', async (req, res) => {
    try {
        await Gallery.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Photo deleted" });
    } catch (error) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// 5. MESSAGES APIs
app.post('/api/messages', async (req, res) => {
    const newMsg = new Message(req.body);
    await newMsg.save();
    res.status(201).json({ success: "Message sent!" });
});
app.get('/api/messages', async (req, res) => {
    const messages = await Message.find().sort({ date: -1 });
    res.status(200).json(messages);
});

// 6. DYNAMIC DASHBOARD STATS (Smart Logic)
app.get('/api/stats', async (req, res) => {
    try {
        const totalBookingsCount = await Booking.countDocuments();
        const newInquiriesCount = await Message.countDocuments();
        
        // ✨ DYNAMIC ROOM COUNT (Jitne rooms database mein hain)
        const TOTAL_TENTS = await Room.countDocuments(); 
        
        const activeBookingsCount = await Booking.countDocuments({ status: { $in: ['Pending', 'Confirmed'] } });
        const availableTentsCount = TOTAL_TENTS - activeBookingsCount;

        const allRooms = await Room.find(); 
        const confirmedBookings = await Booking.find({ status: 'Confirmed' });
        
        let totalRevenue = 0;
        confirmedBookings.forEach(booking => {
            const matchedRoom = allRooms.find(room => room.name === booking.roomType);
            totalRevenue += matchedRoom ? matchedRoom.price : 5000;
        });

        const recentBookings = await Booking.find().sort({ bookingDate: -1 }).limit(3);

        res.status(200).json({
            totalBookings: totalBookingsCount,
            availableTents: availableTentsCount < 0 ? 0 : availableTentsCount,
            totalTentsLimit: TOTAL_TENTS, // Ab ye auto-update hoga!
            totalRevenue: totalRevenue,
            newInquiries: newInquiriesCount,
            recentBookingsSnapshot: recentBookings
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching stats" });
    }
});
// ==========================================
// MISSING REVIEWS API (Add this)
// ==========================================

// 1. Review Schema (Agar pehle se upar nahi hai toh)
const reviewSchema = new mongoose.Schema({
    guestName: String,
    rating: Number,
    comment: String,
    status: { type: String, default: 'Pending' },
    date: { type: Date, default: Date.now }
});

// Model check: Agar model pehle se bana hai toh wahi use karega
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

// 2. Add Review
app.post('/api/reviews', async (req, res) => {
    try {
        const newReview = new Review(req.body);
        await newReview.save();
        res.status(201).json({ message: "Review added!" });
    } catch (error) {
        res.status(500).json({ error: "Error saving review" });
    }
});

// 3. Get All Reviews
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await Review.find().sort({ date: -1 });
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: "Error fetching reviews" });
    }
});

// 4. Delete Review
app.delete('/api/reviews/:id', async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Review deleted!" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting review" });
    }
});
// Server Start
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
// ==========================================
// 11. Admin Login API
// ==========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Yahan terminal mein dikhega ki aap kya type kar rahe ho
    console.log("Trying to login with:", username, "and", password); 

    if (username === "admin" && password === "aamin123") {
        res.status(200).json({ success: true, message: "Login Successful!" });
    } else {
        res.status(401).json({ success: false, message: "Invalid Credentials!" });
    }
});