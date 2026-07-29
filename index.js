const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
     await client.connect();
    console.log("✅ MongoDB Connected");
    const db = client.db(process.env.DB_NAME);

const ticketCollection = db.collection("tickets");
const subscriptionCollection = db.collection("subscriptions");
const userCollection = db.collection("user");
const bookingCollection = db.collection("bookings");

    // Get Tickets
app.post("/subscription", async (req, res) => {
  
    const { user, session_id } = req.body;
    const sub_result = await subscriptionCollection.insertOne({
      userId: new ObjectId(user.id),
      session_id,
    });

    const user_result = await userCollection.updateOne(
      { _id: new ObjectId(user.id) },
      {
        $set: {
          plan: "Pro",
        },
      }
    );
    res.send({
      user_result,
      sub_result
    });
  
});
app.post("/bookings", async (req, res) => {
  try {
    const booking = {
      ...req.body,
      createdAt: new Date(),
    };

    const result =
      await bookingCollection.insertOne(booking);

    res.send(result);

  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
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
    res.status(500).send({
      message: error.message,
    });
  }
});

app.get("/bookings/:email", async (req, res) => {
  try {

    const bookings =
      await bookingCollection
        .find({
          email: req.params.email,
        })
        .sort({
          createdAt: -1,
        })
        .toArray();

    res.send(bookings);

  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

app.patch("/tickets/:id/book", async (req, res) => {
  try {

    const { quantity } = req.body;

    const result =
      await ticketCollection.updateOne(
        {
          _id: new ObjectId(req.params.id),
        },
        {
          $inc: {
            ticketQuantity: -quantity,
          },
        }
      );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      message: error.message,
    });

  }
});


    app.get("/tickets", async (req, res) => {
      const {
        from,
        to,
        transportType,
        sort,
        page = 1,
        limit = 10,
      } = req.query;

      const query = {};

      if (from) query.from = from;
      if (to) query.to = to;
      if (transportType)
        query.transportType = transportType;

      let sortOption = {};

      if (sort === "price-asc")
        sortOption.price = 1;

      if (sort === "price-desc")
        sortOption.price = -1;

      if (sort === "date")
        sortOption.departureDateTime = 1;

      const skip =
        (parseInt(page) - 1) * parseInt(limit);

      const tickets = await ticketCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      const total =
        await ticketCollection.countDocuments(query);

      res.send({
        total,
        page: parseInt(page),
        totalPages: Math.ceil(
          total / parseInt(limit)
        ),
        tickets,
      });
    });

    // Get One Ticket

    app.get("/tickets/:id", async (req, res) => {
  try {

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({
        message: "Invalid Ticket Id",
      });
    }

    const ticket =
      await ticketCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

    if (!ticket) {
      return res.status(404).send({
        message: "Ticket Not Found",
      });
    }

    res.send(ticket);

  } catch (error) {

    res.status(500).send({
      message: error.message,
    });

  }
});

    // Add Ticket

    app.post("/tickets", async (req, res) => {
      const result =
        await ticketCollection.insertOne(req.body);

      res.send(result);
    });

    // Update Ticket

    app.put("/tickets/:id", async (req, res) => {
      const result =
        await ticketCollection.updateOne(
          {
            _id: new ObjectId(req.params.id),
          },
          {
            $set: req.body,
          }
        );

      res.send(result);
    });

    // Delete Ticket

    app.delete("/tickets/:id", async (req, res) => {
      const result =
        await ticketCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

      res.send(result);
    });

    app.get("/", (req, res) => {
      res.send("TicketHub Server Running...");
    });
  } finally {
  }
}

run().catch(console.dir);

// app.listen(port, () => {
//   console.log(`Server Running On ${port}`);
// });
module.exports = app;