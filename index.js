const express = require('express');
const app = express();

const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const port = process.env.PORT || 5000;


// moddleware
app.use(cors());
app.use(express.json());

// creating a custom middleware function for JWT purpose
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access!" });
  }
  // extracting token from authorization code (without bearer)
  const token = authorization.split(" ")[1];
  // console.log("authorization token inside JWT", token);

  // verification
  jwt.verify(token, process.env.JWT_SECRET_ACCESS_TOKEN, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access!" });
    }
    req.decoded = decoded;
    next();
  });
};


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ebwgrc3.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const usersCollection = client.db('summerChamp').collection('users')
    const instructorsCollection = client.db('summerChamp').collection('instructors')
    const classesCollection = client.db('summerChamp').collection('classes')
    const selectedClassesCollection = client.db('summerChamp').collection('selectedClasses')
    const paymentCollection = client.db('summerChamp').collection('payments')




    // JWT operation
    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.JWT_SECRET_ACCESS_TOKEN, {
        expiresIn: "2h",
      });
      // console.log(token);
      res.send({ token });
    });


    // middleware for admin checking.
    const verifyAdmin = async (req, res, next) => {
      const adminCheckEmail = req.decoded.email;
      const query = { email: adminCheckEmail, role: "admin" };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        res.status(403).send({ error: true, message: "forbidden message" });
      }
      next();
    };


    // middleware for instructor checking.
    const verifyInstructor = async (req, res, next) => {
      const instructorCheckEmail = req.decoded.email;
      const query = { email: instructorCheckEmail, role: "instructor" };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        res.status(403).send({ error: true, message: "forbidden message" });
      }
      next();
    };

    


    // to save a user
    // also, this api can be used to set role to an user
    app.put('/users/:email', async (req, res) => {
        const email = req.params.email;
        const user = req.body;
        const query = {email: email};
        const options = {upsert: true};
        const updateDoc = {
            $set: user
        }
        const result = await usersCollection.updateOne(query, updateDoc, options);
        console.log(result);
        res.send(result);
    })


    // to make class status set to "approved" or "denied"
    app.put('/classes/:id', async (req, res) => {
        const id = req.params.id;
        const approvalStatus = req.body;
        const query = {_id: new ObjectId(id)};
        const options = {upsert: true};
        const updateDoc = {
            $set: approvalStatus
        }
        const result = await classesCollection.updateOne(query, updateDoc, options);
        console.log(result);
        res.send(result);
    })


    // get all users
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })


    // get an user
    // also, this api can be used to get role of an user
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = {email : email}
      const result = await usersCollection.findOne(query);
      res.send(result);
    })




    // admin related APIs

    // to get an admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const adminEmail = req.params.email;
      if (req.decoded.email !== adminEmail) {
        res.status(402).send({ error: true, message: "unauthorized Access" });
      }
      const query = { email: adminEmail };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });


    // to get an instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const instructorEmail = req.params.email;
      if (req.decoded.email !== instructorEmail) {
        res.status(402).send({ error: true, message: "unauthorized Access" });
      }
      const query = { email: instructorEmail };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });




    // get all classes open for anyone
    app.get('/classes', async (req, res) => {
        const result = await classesCollection.find().toArray();
        res.send(result);
    })


    // get all classes open for admin only
    app.get('/admin/classes', verifyJWT, verifyAdmin, async (req, res) => {
        const result = await classesCollection.find().toArray();
        res.send(result);
    })


    // get all classes by sorting on available seats
    app.get('/classesByAvailableSeats', async (req, res) => {
        const result = await classesCollection.find().sort({availableSeats: -1}).toArray();
        res.send(result);
    })


    // get all the approved classes
    app.get('/approvedClasses', async (req, res) => {
        const query = {status: 'approved'}
        const result = await classesCollection.find(query).toArray();
        res.send(result);
    })

    
    // get a single class by ID 
    app.get('/classes/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await classesCollection.findOne(query);
      res.send(result);
    })


    // save a selected class data
    app.put('/selectedClasses/:id', async (req, res) => {
      const bookingId = req.params.id;
      const classData = req.body;
      const query = {_id: bookingId};
      const options = {upsert: true};
      const updateDoc = {
          $set: classData
      }
      const result = await selectedClassesCollection.updateOne(query, updateDoc, options);
      console.log(result);
      res.send(result);
    })


    // get all the selected classes
    app.get('/selectedClasses', verifyJWT, async (req, res) => {
      const userEmail = req.query.email;
      const query = {user: userEmail};
      const result = await selectedClassesCollection.find(query).toArray();
      res.send(result);
    })


    // delete a selected class data
    app.delete('/selectedClasses/:id', async  (req, res) => {
      const selectedClassID = req.params.id;
      const query = {_id : selectedClassID};
      const result = await selectedClassesCollection.deleteOne(query);
      res.send(result);
    })




    // get all instructors
    app.get('/instructors', async (req, res) => {
        const result = await instructorsCollection.find().toArray();
        res.send(result);
    })


    // save newClass data in database
    app.post('/classes', async (req, res) => {
      const newClassData = req.body;
      // console.log(newClassData);
      const result = await classesCollection.insertOne(newClassData);
      res.send(result);
    })



    // get all addedClasses for individual instructor by email
    app.get('/instructor/classes/:email', verifyJWT, verifyInstructor, async (req, res) => {
      const userEmail = req.params.email;
      const query = {instructorEmail: userEmail};
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    })


    // get all enrolledClasses for individual student by email
    app.get('/enrolledClasses/:email', verifyJWT, async (req, res) => {
      const userEmail = req.params.email;
      const query = {user: userEmail};
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })





    // create payment intent API

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: price * 100,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    
    // payment related API

    app.post("/payments", verifyJWT, async (req, res) => {
      const paymentInfo = req.body;
      const insertResult = await paymentCollection.insertOne(paymentInfo);

      const query = {bookingId : paymentInfo.classId}
      const deleteResult = await selectedClassesCollection.deleteOne(query);

      res.send({
        insertResult, 
        deleteResult
      });
    });






    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Summer Camp is running')
});

app.listen(port, () => {
    console.log(`Champ is running at: ${port} kmph`);
})