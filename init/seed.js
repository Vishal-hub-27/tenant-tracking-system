const mongoose = require("mongoose");
const Owner = require("./models/owner"); // adjust path if needed

mongoose.connect("mongodb://127.0.0.1:27017/villageTenantDB")
  .then(() => console.log("DB Connected"))
  .catch(err => console.log(err));

const dummyOwners = [
  {
    name: "Ramesh Patil",
    phone: "9876543210",
    email: "ramesh@gmail.com",
    password: "123456",
    house_address: "Main Road, Village A"
  },
  {
    name: "Suresh Shinde",
    phone: "9876543211",
    email: "suresh@gmail.com",
    password: "123456",
    house_address: "Near Temple, Village A"
  },
  {
    name: "Mahesh Jadhav",
    phone: "9876543212",
    email: "mahesh@gmail.com",
    password: "123456",
    house_address: "Bus Stand Road"
  }
];

async function insertData() {
  try {
    await Owner.insertMany(dummyOwners);
    console.log("Dummy data inserted");
    mongoose.connection.close();
  } catch (err) {
    console.log(err);
  }
}

// insertData();