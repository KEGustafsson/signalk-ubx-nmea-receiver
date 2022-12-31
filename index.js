const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const { createDelta, validate } = require('@signalk/signalk-schema');

// Function to calculate the checksum of a UBX message
function calculateChecksum(data) {
  // Initialize the checksum values
  let ckA = 0;
  let ckB = 0;

  // Iterate over the data and update the checksum values
  for (let i = 0; i < data.length; i++) {
    ckA = ckA + data[i];
    ckB = ckB + ckA;
  }

  // Return the checksum as a hex string
  return ckA.toString(16) + ckB.toString(16);
}

// Function to verify the checksum of a UBX message
function verifyChecksum(data) {
  // Extract the checksum from the message
  const checksum = data.slice(-2);

  // Calculate the checksum of the message
  const calculatedChecksum = calculateChecksum(data.slice(2, -2));

  // Compare the calculated checksum to the checksum included in the message
  return calculatedChecksum === checksum;
}

// Open the serial port with the correct baud rate and timeout
const port = new SerialPort('/dev/ttyUSB0', { baudRate: 9600, autoOpen: false });

// Create a parser to split the data into lines
const parser = port.pipe(new Readline({ delimiter: '\n' }));

// Open the serial port and begin reading data
port.open(() => {
  console.log('Serial port opened');

  // Listen for data events from the parser
  parser.on('data', data => {
    // Verify the checksum to ensure the message is valid
    if (!verifyChecksum(data)) {
      console.error('Invalid checksum');
      return;
    }

    // Extract the message type and payload length from the header
    const messageType = data.slice(2, 4);
    const payloadLength = data.slice(4, 6);

    // Parse the payload based on the message type
    switch (messageType) {
      case '0102': // UBX-NAV-PVT message
        // Parse the payload to extract the latitude and longitude
        const lat = data.slice(24, 32);
        const lon = data.slice(32, 40);

// Generate a signalk delta message
const signalkDelta = createDelta({
  updates: [
    {
      source: {
        label: 'GNSS',
      },
      values: [
        {
          path: 'navigation.position',
          value: {
            longitude: lon,
            latitude: lat,
          },
        },
      ],
    },
  ],
});

// Validate the signalk delta message
const validationResult = validate(signalkDelta);

// Print the message if it is valid, or print the error if it is invalid
if (validationResult.valid) {
  console.log(signalkDelta);
} else {
  console.error(validationResult.errors);
}
