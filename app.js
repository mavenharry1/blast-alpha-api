const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

const reserveLimit = 12000;

async function getAddressCategory(address) {
  try {
    const partnersAddresses = new Set(JSON.parse(fs.readFileSync('./json/alpha-partners.json', 'utf8')).map(addr => addr.toLowerCase()));
    const earlyAdoptersAddresses = new Set(JSON.parse(fs.readFileSync('./json/early-adopters.json', 'utf8')).map(addr => addr.toLowerCase()));
    
    const isEligiblePartner = partnersAddresses.has(address.toLowerCase());
    const isEligibleEarlyAdopter = earlyAdoptersAddresses.has(address.toLowerCase());
    
    if(isEligiblePartner) return "partner";
    if(isEligibleEarlyAdopter) return "early";
    return null;
  } catch (error) {
    console.log(error)
    return null;
  }
}

const reservedSpotFile = 'reserved-spots.json';

// Initialize the addresses file if it does not exist
if (!fs.existsSync(reservedSpotFile)) {
  fs.writeFileSync(reservedSpotFile, JSON.stringify([]));
}

app.get('/verify/:address', async (req, res) => {
  const address = req.params.address.toLowerCase();
  const category = await getAddressCategory(address);
  
  if(category === "partner") {
    res.json({ category: "Alpha Partner", amount: 10000 });
  } else if (category === "early") {
    res.json({ category: "Early Adopter", amount: 10000 });
  } else {
    res.json(null);
  }
});

app.get('/reserve/all', (req, res) => {
  const reservedAddresses = JSON.parse(fs.readFileSync(reservedSpotFile, 'utf8'));
  res.json(reservedAddresses);
});

app.get('/reserve/:address', (req, res) => {
  const address = req.params.address.toLowerCase();
  const addresses = new Set(JSON.parse(fs.readFileSync(reservedSpotFile, 'utf8')));
  const isEligible = addresses.has(address);
  if (isEligible) {
    res.json({ amount: 10000, rate: (addresses.size / reserveLimit) * 100 });
  } else {
    res.json({ amount: 0, rate: (addresses.size / reserveLimit) * 100 });
  }
});

app.post('/reserve', async (req, res) => {
  const address = req.body.address.toLowerCase();
  let addresses = new Set(JSON.parse(fs.readFileSync(reservedSpotFile, 'utf8')));

  if (addresses.size >= reserveLimit) {
    res.json({ added: false, message: "Reservation limit reached" });
    return;
  }

  const category = await getAddressCategory(address);
  
  if(category) {
    if (!addresses.has(address)) {
      addresses.add(address);
      fs.writeFileSync(reservedSpotFile, JSON.stringify([...addresses], null, 2)); // Save with formatting
    }

    res.json({ added: true });
  } else {
    res.json({ added: false });
  }
});

app.get('/', (req, res) => {
  res.send('Hello there!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});