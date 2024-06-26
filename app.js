const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
const {MerkleTree} = require("merkletreejs")
const keccak256 = require("keccak256")
const port = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

const reserveLimit = 12000;
const reservedSpotFile = 'reserved-spots.json';

let allowedAddressesFormatted = JSON.parse(fs.readFileSync("./json/allowed-list.json", 'utf8'));
allowedAddressesFormatted = Object.keys(allowedAddressesFormatted).map(key => ({ address: key.toLowerCase(), amount: allowedAddressesFormatted[key] }));

const leaves = allowedAddressesFormatted.map(a => {
  const addressHex = '0x' + a.address.substring(2).padStart(40, '0');
  const amountHex = '0x' + a.amount.toString(16).padStart(64, '0');
  return keccak256(Buffer.from(addressHex.replace('0x', '') + amountHex.replace('0x', ''), 'hex'));
});
const merkleTree = new MerkleTree(leaves, keccak256, {sortPairs: true});
const rootHash = merkleTree.getHexRoot();

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

app.get('/claim/root', async (req, res) => {
  res.json(rootHash);
});

app.get('/claim/:address', (req, res) => {
  const address = req.params.address.toLowerCase();
  const addressFound = allowedAddressesFormatted.find(v => v.address.toLowerCase() === address);
  const amount = addressFound?.amount || 0;
  const addressHex = '0x' + address.substring(2).padStart(40, '0');
  const amountHex = '0x' + amount.toString(16).padStart(64, '0');

  const hashedData = keccak256(Buffer.from(addressHex.replace('0x', '') + amountHex.replace('0x', ''), 'hex'));
  const proof = merkleTree.getHexProof(hashedData);

  res.json({ amount, proof });
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