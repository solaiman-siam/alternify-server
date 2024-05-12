const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8vxmi4o.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const queriesCollection = client.db("alternifyDB").collection("queries");
    const recommendationCollection = client
      .db("alternifyDB")
      .collection("recommendations");

    app.post("/add-queries", async (req, res) => {
      const queries = req.body;
      const result = await queriesCollection.insertOne(queries);
      res.send(result);
    });
    app.get("/all-queries", async (req, res) => {
      const result = await queriesCollection.find().toArray();
      res.send(result);
    });

    app.get("/product-details/:id", async (req, res) => {
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

    app.post("/add-recommendation", async (req, res) => {
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

    app.get("/my-queries", async (req, res) => {
      const email = req.query.email;
      const query = { user_email: email };
      const result = await queriesCollection.find(query).toArray();
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
