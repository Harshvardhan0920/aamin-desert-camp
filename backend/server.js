const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// 1. APP INITIALIZATION & MIDDLEWARE
// ==========================================
const app = express();

// Enable CORS
app.use(cors());

// Parse JSON and URL-encoded data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Static Files (Frontend HTML/CSS/JS and Uploaded Images)
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 2. DATABASE CONNECTION
// ==========================================
// 🛑 IMPORTANT: Yahan apni asli MongoDB Connection String daalna
const MONGO_URI = "YOUR_MONGODB_ATLAS_CONNECTION_STRING"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ==========================================
// 3. MULTER SETUP (For Image Uploads)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads/';
        // Agar uploads folder nahi hai toh auto-create karega
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Unique filename: timestamp + original extension
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 4. DATABASE MODELS (Schemas)
// ==========================================
const GalleryModel = mongoose.model('Gallery', new mongoose.Schema({ 
    image: { type: String, required: true } 
}));

const RoomModel = mongoose.model('Room', new mongoose.Schema({ 
    name: { type: String, required: true }, 
    price: { type: Number, required: true }, 
    description: { type: String }, 
    image: { type: String } 
}));

const BookingModel = mongoose.model('Booking', new mongoose.Schema({ 
    name: String, 
    email: String, 
    phone: String, 
    tentType: String, 
    guests: Number, 
    checkInDate: Date, 
    checkOutDate: Date, 
    status: { type: String, default: 'Pending' } 
}, { timestamps: true }));

const ContactModel = mongoose.model('Contact', new mongoose.Schema({ 
    name: String, 
    email: String, 
    subject: String, 
    message: String, 
    date: { type: Date, default: Date.now } 
}));

const ReviewModel = mongoose.model('Review', new mongoose.Schema({ 
    name: String, 
    text: String, 
    rating: Number, 
    adminReply: { type: String, default: "" }, 
    createdAt: { type: Date, default: Date.now } 
}));

// ==========================================
// 5. API ROUTES
// ==========================================

// --- ADMIN LOGIN ---
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    // Hardcoded credentials for admin
    if (username === "admin" && password === "admin123") {
        res.status(200).json({ message: "Login successful!" });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// --- GALLERY API ---
app.get('/api/gallery', async (req, res) => {
    try {
        const photos = await GalleryModel.find().sort({ _id: -1 });
        res.status(200).json(photos);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch gallery" });
    }
});

app.post('/api/gallery', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image file provided" });
        const imageUrl = `/uploads/${req.file.filename}`;
        const newPhoto = new GalleryModel({ image: imageUrl });
        await newPhoto.save();
        res.status(201).json({ message: "Photo added successfully", photo: newPhoto });
    } catch (error) {
        res.status(500).json({ error: "Failed to upload photo" });
    }
});

app.delete('/api/gallery/:id', async (req, res) => {
    try {
        const photo = await GalleryModel.findByIdAndDelete(req.params.id);
        if (photo && photo.image) {
            const filePath = path.join(__dirname, photo.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // File storage se delete karo
        }
        res.status(200).json({ message: "Photo deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete photo" });
    }
});

// --- ROOMS API ---
app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await RoomModel.find().sort({ _id: -1 });
        res.status(200).json(rooms);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch rooms" });
    }
});

app.post('/api/rooms', upload.single('image'), async (req, res) => {
    try {
        const { name, price, description } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
        const newRoom = new RoomModel({ name, price, description, image: imageUrl });
        await newRoom.save();
        res.status(201).json({ message: "Room added successfully", room: newRoom });
    } catch (error) {
        res.status(500).json({ error: "Failed to create room" });
    }
});

app.put('/api/rooms/:id', upload.single('image'), async (req, res) => {
    try {
        const { name, price, description } = req.body;
        let updateData = { name, price, description };
        
        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
            // Optional: Delete old image from storage here
        }
        
        const updatedRoom = await RoomModel.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.status(200).json({ message: "Room updated", room: updatedRoom });
    } catch (error) {
        res.status(500).json({ error: "Failed to update room" });
    }
});

app.delete('/api/rooms/:id', async (req, res) => {
    try {
        const room = await RoomModel.findByIdAndDelete(req.params.id);
        if (room && room.image) {
            const filePath = path.join(__dirname, room.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        res.status(200).json({ message: "Room deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete room" });
    }
});

// --- BOOKINGS API ---
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await BookingModel.find().sort({ createdAt: -1 });
        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const newBooking = new BookingModel(req.body);
        await newBooking.save();
        res.status(201).json({ message: "Booking saved successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save booking" });
    }
});

app.put('/api/bookings/:id/status', async (req, res) => {
    try {
        const updatedBooking = await BookingModel.findByIdAndUpdate(
            req.params.id, 
            { status: req.body.status }, 
            { new: true }
        );
        res.status(200).json({ message: "Booking status updated", booking: updatedBooking });
    } catch (error) {
        res.status(500).json({ error: "Failed to update status" });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await BookingModel.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Booking deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete booking" });
    }
});

// --- MESSAGES API (Contact Us) ---
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await ContactModel.find().sort({ date: -1 });
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const newMessage = new ContactModel(req.body);
        await newMessage.save();
        res.status(201).json({ message: "Message sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to send message" });
    }
});

app.put('/api/messages/:id', async (req, res) => {
    try {
        const updatedMsg = await ContactModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ message: "Message updated", data: updatedMsg });
    } catch (error) {
        res.status(500).json({ error: "Failed to update message" });
    }
});

app.delete('/api/messages/:id', async (req, res) => {
    try {
        await ContactModel.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Message deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete message" });
    }
});

// --- REVIEWS API ---
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await ReviewModel.find().sort({ createdAt: -1 });
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const newReview = new ReviewModel(req.body);
        await newReview.save();
        res.status(201).json({ message: "Review published" });
    } catch (error) {
        res.status(500).json({ error: "Failed to publish review" });
    }
});

app.put('/api/reviews/:id', async (req, res) => {
    try {
        const updatedReview = await ReviewModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ message: "Review updated", review: updatedReview });
    } catch (error) {
        res.status(500).json({ error: "Failed to update review" });
    }
});

app.delete('/api/reviews/:id', async (req, res) => {
    try {
        await ReviewModel.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Review deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete review" });
    }
});

// ==========================================
// 6. SERVER STARTUP
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running flawlessly on port ${PORT}`);
});