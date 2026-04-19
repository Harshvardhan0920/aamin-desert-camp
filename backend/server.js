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
// dotenv install hona chahiye (agar nahi hai toh 'npm install dotenv' terminal mein chalao)
require('dotenv').config(); 

const dbURI = process.env.MONGO_URI; // Ye Render ke Environment tab se link uthayega

mongoose.connect(dbURI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.log('DB Connection Error:', err));
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
// Rooms add karne ka API route
// 1. UPDATE (Edit) Room
app.put('/api/rooms/:id', async (req, res) => {
    try {
        const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ message: "Room updated successfully!", room: updatedRoom });
    } catch (error) {
        console.error("Error updating room:", error);
        res.status(500).json({ error: "Failed to update room" });
    }
});

// 2. DELETE Room
app.delete('/api/rooms/:id', async (req, res) => {
    try {
        await Room.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Room deleted successfully!" });
    } catch (error) {
        console.error("Error deleting room:", error);
        res.status(500).json({ error: "Failed to delete room" });
    }
});

// 2. GET ROOMS
app.get('/api/rooms', async (req, res) => {
    const rooms = await Room.find();
    res.status(200).json(rooms);
});

// 3. DELETE ROOM
/*app.delete('/api/rooms/:id', async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Room deleted!" });
});*/

// 4. BOOKINGS APIs
// ==========================================
// Bookings Management API
// ==========================================

// 1. Get all bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await BookingModel.find().sort({ createdAt: -1 }); // Nayi booking upar aayegi
        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

// 2. Update Booking Status (Confirmed, Cancelled, etc.)
app.put('/api/bookings/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedBooking = await BookingModel.findByIdAndUpdate(
            req.params.id, 
            { status: status }, 
            { new: true }
        );
        res.status(200).json({ message: "Status updated!", booking: updatedBooking });
    } catch (error) {
        res.status(500).json({ error: "Failed to update status" });
    }
});

// 3. Delete Booking
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await BookingModel.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Booking deleted!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete booking" });
    }
});
// ==========================================
// 10. Gallery System
// ==========================================

// 1. Gallery Schema
// server.js mein ye check karo
const GallerySchema = new mongoose.Schema({
    image: String,
    // baaki fields...
});

// Model ka naam 'Gallery' hai, toh Mongoose automatically 'galleries' collection dhundega
const GalleryModel = mongoose.model('Gallery', GallerySchema);
// 2. Upload Photo to Gallery
// ==========================================
// Gallery Management API
// ==========================================

// 1. Add New Photo
app.post('/api/gallery', async (req, res) => {
    try {
        const newPhoto = new GalleryModel({ image: req.body.image });
        await newPhoto.save();
        res.status(201).json({ message: "Photo added successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to add photo" });
    }
});

// 2. Update (Edit) Photo URL
app.put('/api/gallery/:id', async (req, res) => {
    try {
        const updatedPhoto = await GalleryModel.findByIdAndUpdate(
            req.params.id, 
            { image: req.body.image }, 
            { new: true }
        );
        res.status(200).json({ message: "Photo updated!", photo: updatedPhoto });
    } catch (error) {
        res.status(500).json({ error: "Failed to update photo" });
    }
});

// 3. Delete Photo
app.delete('/api/gallery/:id', async (req, res) => {
    try {
        await GalleryModel.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Photo deleted!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete photo" });
    }
});
// 5. MESSAGES APIs
// ==========================================
// Messages / Inquiry Management API
// ==========================================

// 1. Saare messages fetch karna
// Update (Edit) Message
app.put('/api/messages/:id', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        const updatedMsg = await ContactModel.findByIdAndUpdate(
            req.params.id, 
            { name, email, subject, message }, 
            { new: true }
        );
        res.status(200).json({ message: "Message updated!", data: updatedMsg });
    } catch (error) {
        res.status(500).json({ error: "Failed to update message" });
    }
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
// ==========================================
// Reviews & Ratings API
// ==========================================

// 1. Get all reviews
app.get('/api/reviews', async (req, res) => {
    try {
        // Naye reviews pehle dikhenge
        const reviews = await ReviewModel.find().sort({ createdAt: -1 }); 
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

// 2. Add a new review
app.post('/api/reviews', async (req, res) => {
    try {
        const { name, text, rating } = req.body;
        const newReview = new ReviewModel({ name, text, rating });
        await newReview.save();
        res.status(201).json({ message: "Review added successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to add review" });
    }
});

// 3. Update (Edit) a review
app.put('/api/reviews/:id', async (req, res) => {
    try {
        const { name, text, rating } = req.body;
        const updatedReview = await ReviewModel.findByIdAndUpdate(
            req.params.id, 
            { name, text, rating }, 
            { new: true }
        );
        res.status(200).json({ message: "Review updated!", review: updatedReview });
    } catch (error) {
        res.status(500).json({ error: "Failed to update review" });
    }
});

// 4. Delete a review
app.delete('/api/reviews/:id', async (req, res) => {
    try {
        await ReviewModel.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Review deleted!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete review" });
    }
});// Ye code copy-paste karo
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// app.get('*', (req, res) => {
//    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
// });
// ==========================================
// Contact Form System
// ==========================================

// 1. Contact Schema (Database Design)
const contactSchema = new mongoose.Schema({
    name: String,
    email: String,
    subject: String,
    message: String,
    date: { type: Date, default: Date.now } // Ye apne aap aaj ki date save kar lega
});

// Ye MongoDB mein 'contacts' naam ka collection banayega
const ContactModel = mongoose.model('Contact', contactSchema);

// 2. API Route (Frontend se data lene ke liye)
app.post('/api/contact', async (req, res) => {
    try {
        console.log("New Contact Message:", req.body); // Terminal mein dekhne ke liye

        // Frontend se jo data aaya, use model mein daalo
        const newMessage = new ContactModel(req.body);
        
        // Data ko MongoDB mein save karo
        await newMessage.save();

        // Frontend ko "Success" message bhejo
        res.status(200).json({ message: "Message saved successfully!" });
    } catch (error) {
        console.error("Contact form error:", error);
        res.status(500).json({ error: "Failed to save message." });
    }
});

// ==========================================
// Admin Login System
// ==========================================
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    // Yahan tumhara ADMIN USERNAME aur PASSWORD set hai
    // Tum isko baad mein change kar sakte ho
    const adminUser = "admin";
    const adminPass = "admin123"; 

    if (username === adminUser && password === adminPass) {
        // Agar password sahi hai
        res.status(200).json({ message: "Login successful!" });
    } else {
        // Agar password galat hai
        res.status(401).json({ error: "Invalid username or password!" });
    }
});
// Server Start

const PORT = process.env.PORT || 5000; // Render ke liye zaroori hai
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
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