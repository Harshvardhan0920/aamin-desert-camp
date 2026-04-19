const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Static Files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 1. DATABASE CONNECTION
// ==========================================
// 🛑 IMPORTANT: Yahan apni asli MongoDB Atlas String daalna!
const MONGO_URI = "mongodb+srv://admin:AaminDesert@cluster0.ptckt1u.mongodb.net/?appName=Cluster0"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err.message));

// ==========================================
// 2. EMAIL SETUP (NODEMAILER)
// ==========================================
// 🛑 IMPORTANT: Apna Gmail aur App Password yahan dalo!
const ADMIN_EMAIL = 'aamindesertcamp@gmail.com'; 
const ADMIN_PASS = 'uwes vbql pbim gtaw';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: ADMIN_EMAIL, 
        pass: ADMIN_PASS     
    }
});

// ==========================================
// 3. MULTER STORAGE SETUP
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
// 4. DATABASE MODELS
// ==========================================
const GalleryModel = mongoose.model('Gallery', new mongoose.Schema({ image: String }));
const RoomModel = mongoose.model('Room', new mongoose.Schema({ name: String, price: Number, description: String, image: String }));
const ContactModel = mongoose.model('Contact', new mongoose.Schema({ name: String, email: String, subject: String, message: String, date: { type: Date, default: Date.now } }));
const ReviewModel = mongoose.model('Review', new mongoose.Schema({ guestName: String, comment: String, rating: Number, adminReply: String, createdAt: { type: Date, default: Date.now } }));

const BookingModel = mongoose.model('Booking', new mongoose.Schema({ 
    name: String, email: String, phone: String, tentType: String, 
    guests: Number, checkInDate: Date, checkOutDate: Date, 
    status: { type: String, default: 'Pending' } 
}, { timestamps: true }));

// ==========================================
// 5. API ROUTES
// ==========================================

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin123") res.status(200).json({ message: "Login successful!" });
    else res.status(401).json({ error: "Invalid credentials" });
});

app.get('/api/stats', async (req, res) => {
    try {
        const confirmedBookings = await BookingModel.countDocuments({ status: 'Confirmed' });
        res.json({ availableTents: Math.max(0, 15 - confirmedBookings) });
    } catch (e) { res.status(500).json({ error: "Server Error", availableTents: 5 }); }
});

// --- GALLERY ---
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

// --- ROOMS ---
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

// --- BOOKINGS (WITH EMAIL NOTIFICATIONS TO ADMIN) ---
app.get('/api/bookings', async (req, res) => res.json(await BookingModel.find().sort({createdAt: -1})));
app.post('/api/bookings', async (req, res) => {
    try {
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

        // 1. Email to Admin (Notification for you!)
        const adminMailOptions = {
            from: `"Desert Camp System" <${ADMIN_EMAIL}>`,
            to: ADMIN_EMAIL, 
            subject: `🚨 New Booking Alert: ${bookingData.name}`,
            text: `Hello Admin,\n\nYou have a new booking request!\n\nDetails:\nName: ${bookingData.name}\nPhone: ${bookingData.phone}\nEmail: ${bookingData.email}\nTent: ${bookingData.tentType}\nDates: ${bookingData.checkInDate} to ${bookingData.checkOutDate}\nGuests: ${bookingData.guests}\n\nPlease check the admin dashboard to confirm.`
        };

        // 2. Email to Customer
        const customerMailOptions = {
            from: `"Aamin Desert Camp" <${ADMIN_EMAIL}>`,
            to: bookingData.email,
            subject: '🏕️ Booking Received - Aamin Desert Camp',
            text: `Hello ${bookingData.name},\n\nWe have received your booking request for the ${bookingData.tentType} from ${bookingData.checkInDate} to ${bookingData.checkOutDate}.\n\nOur team will review and confirm shortly.\n\nWarm Regards,\nAamin Desert Camp`
        };

        // Send both emails
        transporter.sendMail(adminMailOptions, (error) => { if(error) console.log("Admin Email Failed:", error.message); });
        transporter.sendMail(customerMailOptions, (error) => { if(error) console.log("Customer Email Failed:", error.message); });

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
        
        // Notify Admin of new message
        const msgMail = {
            from: `"Website Contact" <${ADMIN_EMAIL}>`,
            to: ADMIN_EMAIL,
            subject: `✉️ New Message from ${req.body.name}`,
            text: `Name: ${req.body.name}\nEmail: ${req.body.email}\nSubject: ${req.body.subject}\nMessage:\n${req.body.message}`
        };
        transporter.sendMail(msgMail);

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

// --- REVIEWS ---
app.get('/api/reviews', async (req, res) => res.json(await ReviewModel.find().sort({createdAt: -1})));
app.post('/api/reviews', async (req, res) => {
    try {
        const revData = { guestName: req.body.name, comment: req.body.text, rating: req.body.rating, adminReply: req.body.adminReply || "" };
        await ReviewModel.create(revData);
        res.status(201).json({ message: "Review added" });
    } catch (e) { res.status(500).json({ error: "Error adding review" }); }
});
app.put('/api/reviews/:id', async (req, res) => {
    const updateData = { guestName: req.body.name, comment: req.body.text, rating: req.body.rating, adminReply: req.body.adminReply };
    await ReviewModel.findByIdAndUpdate(req.params.id, updateData);
    res.json({ message: "Updated" });
});
app.delete('/api/reviews/:id', async (req, res) => {
    await ReviewModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// ==========================================
// 6. SERVER STARTUP
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Desert Camp Server is running on port ${PORT}`);
});