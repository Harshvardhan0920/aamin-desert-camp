const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// ==========================================
// 1. APP CONFIGURATION & MIDDLEWARE
// ==========================================
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Static Files (Frontend + Uploaded Images)
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 2. DATABASE CONNECTION
// ==========================================
// 🛑 IMPORTANT: Yahan apni asli MongoDB Atlas String daalna!
const MONGO_URI = "YOUR_MONGODB_ATLAS_CONNECTION_STRING"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err.message));

// ==========================================
// 3. EMAIL SETUP (NODEMAILER)
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // 🛑 IMPORTANT: Apna Gmail aur 16-digit App Password yahan dalo!
        user: 'aamindesertcamp@gmail.com', 
        pass: 'uwes vbql pbim gtawE'     
    }
});

// ==========================================
// 4. MULTER STORAGE SETUP (For Images)
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
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 5. DATABASE MODELS (Schemas)
// ==========================================
const GalleryModel = mongoose.model('Gallery', new mongoose.Schema({ 
    image: String 
}));

const RoomModel = mongoose.model('Room', new mongoose.Schema({ 
    name: String, price: Number, description: String, image: String 
}));

const BookingModel = mongoose.model('Booking', new mongoose.Schema({ 
    name: String, email: String, phone: String, tentType: String, 
    guests: Number, checkInDate: Date, checkOutDate: Date, 
    status: { type: String, default: 'Pending' } 
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
// 6. API ROUTES
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

// --- STATS API (For booking.html inventory check) ---
app.get('/api/stats', async (req, res) => {
    try {
        const confirmedBookings = await BookingModel.countDocuments({ status: 'Confirmed' });
        let totalTentsAvailable = 15 - confirmedBookings; // Base inventory is 15 tents
        res.json({ availableTents: Math.max(0, totalTentsAvailable) });
    } catch (e) { 
        res.status(500).json({ error: "Server Error", availableTents: 5 }); 
    }
});

// --- GALLERY API ---
app.get('/api/gallery', async (req, res) => res.json(await GalleryModel.find().sort({_id: -1})));

app.post('/api/gallery', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        await GalleryModel.create({ image: `/uploads/${req.file.filename}` });
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

// --- ROOMS API ---
app.get('/api/rooms', async (req, res) => res.json(await RoomModel.find().sort({_id: -1})));

app.post('/api/rooms', upload.single('image'), async (req, res) => {
    try {
        const { name, price, description } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
        await RoomModel.create({ name, price, description, image: imageUrl });
        res.status(201).json({ message: "Room added" });
    } catch (e) { res.status(500).json({ error: "Error adding room" }); }
});

app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {
    try {
        let updateData = { name: req.body.name, price: req.body.price, description: req.body.description };
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

// --- BOOKINGS API (With Email) ---
app.get('/api/bookings', async (req, res) => res.json(await BookingModel.find().sort({createdAt: -1})));

app.post('/api/bookings', async (req, res) => {
    try {
        // Map fields from booking.html to BookingModel
        const bookingData = {
            name: req.body.guestName,
            email: req.body.email,
            phone: req.body.phone,
            tentType: req.body.roomType,
            checkInDate: req.body.checkIn,
            checkOutDate: req.body.checkOut,
            guests: parseInt(req.body.adults || 0) + parseInt(req.body.children || 0),
            status: 'Pending'
        };
        await BookingModel.create(bookingData);

        // Send Email to Customer
        const mailOptions = {
            from: 'Aamin Desert Camp <YOUR_EMAIL_HERE@gmail.com>', // Replace with your email
            to: bookingData.email,
            subject: '🏕️ Booking Received - Aamin Desert Camp',
            text: `Hello ${bookingData.name},\n\nThank you for choosing Aamin Desert Camp!\n\nWe have received your booking request for the ${bookingData.tentType} from ${bookingData.checkInDate} to ${bookingData.checkOutDate} for ${bookingData.guests} guests.\n\nOur team is reviewing your request and will get back to you shortly to confirm your reservation.\n\nWarm Regards,\nAamin Desert Camp Team\n+91 9352918751`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.log("⚠️ Email Failed:", error.message);
            else console.log("📧 Email sent:", info.response);
        });

        res.status(201).json({ message: "Booking saved" });
    } catch (e) { res.status(500).json({ error: "Save failed" }); }
});

app.put('/api/bookings/:id/status', async (req, res) => {
    try {
        await BookingModel.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.json({ message: "Status updated" });
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await BookingModel.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

// --- CONTACT / MESSAGES API ---
// Public contact form posts here
app.post('/api/contact', async (req, res) => {
    try {
        await ContactModel.create(req.body);
        res.status(201).json({ message: "Message sent" });
    } catch (e) { res.status(500).json({ error: "Error sending message" }); }
});

// Admin panel fetches from here
app.get('/api/messages', async (req, res) => res.json(await ContactModel.find().sort({date: -1})));

app.put('/api/messages/:id', async (req, res) => {
    try {
        await ContactModel.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Updated" });
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/messages/:id', async (req, res) => {
    try {
        await ContactModel.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

// --- REVIEWS API ---
app.get('/api/reviews', async (req, res) => res.json(await ReviewModel.find().sort({createdAt: -1})));

app.post('/api/reviews', async (req, res) => {
    try {
        // Map fields from admin-reviews.html to ReviewModel
        const revData = { 
            guestName: req.body.name, 
            comment: req.body.text, 
            rating: req.body.rating,
            adminReply: req.body.adminReply || ""
        };
        await ReviewModel.create(revData);
        res.status(201).json({ message: "Review added" });
    } catch (e) { res.status(500).json({ error: "Error adding review" }); }
});

app.put('/api/reviews/:id', async (req, res) => {
    try {
        const updateData = {
            guestName: req.body.name,
            comment: req.body.text,
            rating: req.body.rating,
            adminReply: req.body.adminReply
        };
        await ReviewModel.findByIdAndUpdate(req.params.id, updateData);
        res.json({ message: "Updated" });
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/reviews/:id', async (req, res) => {
    try {
        await ReviewModel.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

// ==========================================
// 7. SERVER STARTUP
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Desert Camp Server is running on port ${PORT}`);
});