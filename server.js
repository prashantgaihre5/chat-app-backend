const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const secretKey = 'your-secret-key';

mongoose.connect('mongodb://localhost:27017/chatapplication', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  imageUrl: String,
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const User = mongoose.model('User', userSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).populate('contacts');
    if (user && user.password === password) {
      const token = jwt.sign({ email: user.email, name: user.name }, secretKey, { expiresIn: '1h' });
      res.status(200).json({ message: 'Login successful', user, token });
    } else {
      res.status(400).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

app.post('/signup', upload.single('profilePicture'), async (req, res) => {
  const { email, password, name } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
    } else {
      const user = new User({ email, password, name, imageUrl });
      await user.save();
      res.status(201).json({ message: 'Signup successful', user });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

app.post('/completeProfile', upload.single('profilePicture'), async (req, res) => {
  const { name, email } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const user = await User.findOne({ email });
    if (user) {
      user.name = name;
      if (imageUrl) user.imageUrl = imageUrl;
      await user.save();
      res.status(201).json({ message: 'Profile updated successfully', user });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

app.post('/addContact', async (req, res) => {
  const { userEmail, contactEmail } = req.body;
  try {
    const user = await User.findOne({ email: userEmail });
    const contact = await User.findOne({ email: contactEmail });

    if (!user || !contact) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.contacts.includes(contact._id)) {
      user.contacts.push(contact._id);
      await user.save();
    }

    if (!contact.contacts.includes(user._id)) {
      contact.contacts.push(user._id);
      await contact.save();
    }

    res.status(200).json({ message: 'Contact added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

app.get('/contacts', async (req, res) => {
  const { email } = req.query;
  try {
    const user = await User.findOne({ email }).populate('contacts');
    if (user) {
      res.status(200).json({ contacts: user.contacts });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

io.on('connection', (socket) => {
  console.log('a user connected');
  
  socket.on('join', ({ name, room }) => {
    socket.join(room);
    console.log(`${name} joined room ${room}`);
  });

  socket.on('private_message', (data) => {
    const { message, sender, receiver } = data;
    io.to(receiver).emit('private_message', { sender, message });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
