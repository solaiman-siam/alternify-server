require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());

//Must remove "/" from your production URL

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://alternify-15eba.web.app",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8vxmi4o.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// token verify
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      req.user = decoded;
      next();
    });
  }
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const queriesCollection = client.db("alternifyDB").collection("queries");
    const donationCollection = client.db("alternifyDB").collection("donations");
    const recommendationCollection = client
      .db("alternifyDB")
      .collection("recommendations");

    // donate related api
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post("/donations", async (req, res) => {
      const donationInfo = req.body;
      const result = await donationCollection.insertOne(donationInfo);
      res.send(result);
    });

    // creating jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // logout and clear cookie
    app.post("/logout", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    // add query
    app.post("/add-queries", verifyToken, async (req, res) => {
      const queries = req.body;
      const result = await queriesCollection.insertOne(queries);
      res.send(result);
    });
    // all queries
    app.get("/all-queries", async (req, res) => {
      const result = await queriesCollection.find().toArray();
      res.send(result);
    });

    app.get("/queries", async (req, res) => {
      const page = parseInt(req.query.page) - 1;
      const size = parseInt(req.query.size);
      const search = req.query.search;
      const query = {
        product_name: { $regex: `${search}`, $options: "i" },
      };
      const result = await queriesCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/queries-count", async (req, res) => {
      const search = req.query.search;
      const query = {
        product_name: { $regex: `${search}`, $options: "i" },
      };
      const count = await queriesCollection.countDocuments(query);
      res.send({ count });
    });
    // product details
    app.get("/product-details/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await queriesCollection.findOne(query);
      res.send(result);
    });

    app.get("/recommended-queries/:id", async (req, res) => {
      const params = req.params.id;
      const query = { queryId: params };
      const result = await recommendationCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/add-recommendation", verifyToken, async (req, res) => {
      const recommendedData = req.body;
      const id = recommendedData.queryId;
      const filter = { _id: new ObjectId(id) };

      const result = recommendationCollection.insertOne(recommendedData);

      const updateDoc = {
        $inc: {
          recommendation_count: +1,
        },
      };
      const updateRecommendationCount = await queriesCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    app.get("/recent-queries", async (req, res) => {
      const result = await queriesCollection.find().toArray();
      res.send(result);
    });

    // delete recommendation
    app.delete("/delete-recommendation/:id", async (req, res) => {
      const countId = req.body.var1;
      const id = req.params.id;
      const filter = { _id: new ObjectId(countId) };
      const query = { _id: new ObjectId(id) };

      const updateDoc = {
        $inc: {
          recommendation_count: -1,
        },
      };
      const updateRecommendationCount = await queriesCollection.updateOne(
        filter,
        updateDoc
      );

      const result = await recommendationCollection.deleteOne(query);

      res.send(result);
    });

    app.get("/my-queries", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { user_email: email };
      const result = await queriesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/recommendation-for-me", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { user_email: email };
      const result = await recommendationCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/my-recommendation", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { recommender_email: email };
      const result = await recommendationCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/delete-queries/:id", async (req, res) => {
      const params = req.params.id;
      const query = { _id: new ObjectId(params) };
      const result = queriesCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/update-queries/:id", async (req, res) => {
      const params = req.params.id;
      const updateData = req.body;
      const filter = { _id: new ObjectId(params) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          product_name: updateData.product_name,
          image_url: updateData.image_url,
          details: updateData.details,
          query_title: updateData.query_title,
          brand: updateData.brand,
        },
      };

      const result = queriesCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("alternify server is running");
});

app.listen(port, () => {
  console.log("alternify is running in port ", port);
});
