const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database Collections Globally Define করা
const db = client.db(process.env.DB_NAME);
const ticketCollection = db.collection("tickets");
const subscriptionCollection = db.collection("subscriptions");
const userCollection = db.collection("user");
const bookingCollection = db.collection("bookings");
const bookingPaymentCollection = db.collection("bookingPayment");

async function connectDB() {
  try {
    // client.connect() serverless-এ বাধ্যতামূলক নয়, তবে রাখলেও সমস্যা নেই
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
  }
}
connectDB();

// Root Route
app.get("/", (req, res) => {
  res.send("TicketHub Server is Running...");
});

// Add Ticket
app.post("/tickets", async (req, res) => {
  try {
    const result = await ticketCollection.insertOne(req.body);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Get Tickets
app.get("/tickets", async (req, res) => {
  try {
    const { from, to, transportType, sort, page = 1, limit = 10 } = req.query;

    const query = {};

    if (from) query.from = from;
    if (to) query.to = to;
    if (transportType) query.transportType = transportType;

    let sortOption = {};

    if (sort === "price-asc") sortOption.price = 1;
    if (sort === "price-desc") sortOption.price = -1;
    if (sort === "date") sortOption.departureDateTime = 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await ticketCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await ticketCollection.countDocuments(query);

    res.send({
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      tickets,
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Get One Ticket
app.get("/tickets/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid Ticket Id" });
    }

    const ticket = await ticketCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!ticket) {
      return res.status(404).send({ message: "Ticket Not Found" });
    }

    res.send(ticket);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Update Ticket
app.put("/tickets/:id", async (req, res) => {
  try {
    const result = await ticketCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Subscription
app.post("/subscription", async (req, res) => {
  try {
    const { user, session_id } = req.body;
     const isExisting = await subscriptionCollection.findOne({ userId: new ObjectId(user.id), ticketId: new ObjectId(ticketId) });
    if (isExisting) {
      return res.status(400).send({ message: "You have already booked this ticket." });
    }
    const sub_result = await subscriptionCollection.insertOne({
      userId: new ObjectId(user.id),
      session_id,
    });

    const user_result = await userCollection.updateOne(
      { _id: new ObjectId(user.id) },
      { $set: { plan: "pro" } }
    );
    res.send({ user_result, sub_result });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

//booking Payment
app.post("/bookingPayment", async (req, res) => {
  try {
    const { ticketId, title, price, userId, session_id } = req.body;

    // 1. Validate required fields
    if (!userId || !ticketId) {
      return res.status(400).send({ 
        message: "Missing required fields: both userId and ticketId are required." 
      });
    }

    // 2. Validate MongoDB ObjectIds to prevent crash on invalid strings or empty strings
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(ticketId)) {
      return res.status(400).send({ 
        message: "Invalid userId or ticketId format." 
      });
    }

    const userObjectId = new ObjectId(userId);
    const ticketObjectId = new ObjectId(ticketId);

    // 3. Check for existing booking
    const isExisting = await bookingPaymentCollection.findOne({ 
      userId: userObjectId, 
      ticketId: ticketObjectId 
    });

    if (isExisting) {
      return res.status(400).send({ message: "You have already booked this ticket." });
    }

    // 4. Insert booking document
    const sub_result = await bookingPaymentCollection.insertOne({
      userId: userObjectId,
      ticketId: ticketObjectId,
      title,
      price: Number(price),
      session_id,
      createdAt: new Date()
    });

    return res.status(200).send({ success: true, sub_result });

  } catch (error) {
    console.error("Booking Payment Error:", error);
    return res.status(500).send({ message: error.message || "Internal Server Error" });
  }
});

// Bookings
app.post("/bookings", async (req, res) => {
  try {
    const booking = { ...req.body, createdAt: new Date() };
    const result = await bookingCollection.insertOne(booking);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.get("/transactions/:email", async (req, res) => {
  try {
    const transactions = await subscriptionCollection
      .find({ email: req.params.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(transactions);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.get("/bookings/:email", async (req, res) => {
  try {
    const bookings = await bookingCollection
      .find({ email: req.params.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(bookings);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.patch("/tickets/:id/book", async (req, res) => {
  try {
    const { quantity } = req.body;
    const result = await ticketCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { ticketQuantity: -quantity } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Delete Ticket
app.delete("/tickets/:id", async (req, res) => {
  try {
    const result = await ticketCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Vercel Serverless Export
module.exports = app;