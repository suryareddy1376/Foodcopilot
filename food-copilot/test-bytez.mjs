// Quick test script for Bytez SDK
import Bytez from 'bytez.js';

const key = "960596a85b8161c0fb4d0504312c00ce";
const sdk = new Bytez(key);

// choose claude-opus-4-5
const model = sdk.model("anthropic/claude-opus-4-5");

async function testBytez() {
  console.log('Testing Bytez SDK...');
  
  try {
    // send input to model
    const { error, output } = await model.run([
      {
        "role": "user",
        "content": "Hello, just say 'Hi there!' and nothing else."
      }
    ]);

    console.log('Result:', { error, output });
    
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Success! Output type:', typeof output);
      console.log('Output:', JSON.stringify(output, null, 2));
    }
  } catch (e) {
    console.error('Exception:', e);
  }
}

testBytez();
