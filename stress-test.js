const Y = require('yjs');

async function runStressTest() {
  console.log("Starting Yjs CRDT Stress Test...");
  const clientsCount = 5;
  const iterations = 100;
  
  // Create N clients
  const docs = Array.from({ length: clientsCount }).map(() => new Y.Doc());
  const texts = docs.map(doc => doc.getText('monaco'));
  
  // Mock network: broadcast updates to all other clients
  docs.forEach((doc, i) => {
    doc.on('update', (update) => {
      docs.forEach((otherDoc, j) => {
        if (i !== j) {
          Y.applyUpdate(otherDoc, update);
        }
      });
    });
  });

  // Simulate concurrent edits
  console.log(`Simulating ${clientsCount} clients making ${iterations} rapid concurrent edits...`);
  
  for (let i = 0; i < iterations; i++) {
    // All clients type concurrently at random positions
    docs.forEach((doc, idx) => {
      const text = texts[idx];
      const pos = Math.floor(Math.random() * (text.length + 1));
      const char = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // random a-z
      text.insert(pos, char);
    });
  }

  // Final convergence check
  console.log("Verifying convergence...");
  
  const finalState0 = texts[0].toString();
  let converged = true;
  
  for (let i = 1; i < clientsCount; i++) {
    const state = texts[i].toString();
    if (state !== finalState0) {
      converged = false;
      console.error(`Client ${i} diverged!`);
      console.error(`Client 0: ${finalState0}`);
      console.error(`Client ${i}: ${state}`);
    }
  }

  if (converged) {
    console.log(`SUCCESS! All ${clientsCount} clients converged to identical state:`);
    console.log(`Final document length: ${finalState0.length} characters.`);
    // console.log(`State: ${finalState0.substring(0, 50)}...`);
  } else {
    process.exit(1);
  }
}

runStressTest();
