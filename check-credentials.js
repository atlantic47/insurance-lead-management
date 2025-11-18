const axios = require('axios');

/**
 * This script helps you verify your WhatsApp/Facebook credentials
 * Run with: node check-credentials.js
 */

async function checkCredentials() {
  // REPLACE THESE WITH YOUR ACTUAL VALUES FROM THE DATABASE
  const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE';
  const BUSINESS_ACCOUNT_ID = 'YOUR_BUSINESS_ACCOUNT_ID_HERE';

  console.log('\n=== WhatsApp/Facebook Credentials Checker ===\n');

  // Trim the token (this is what the backend does now)
  const trimmedToken = ACCESS_TOKEN.trim();

  console.log('Access Token (first 20 chars):', trimmedToken.substring(0, 20) + '...');
  console.log('Business Account ID:', BUSINESS_ACCOUNT_ID);
  console.log('Token length:', trimmedToken.length);
  console.log('Has leading/trailing spaces:', ACCESS_TOKEN !== trimmedToken);
  console.log('\n');

  try {
    // Test 1: Get Business Account Info
    console.log('Test 1: Fetching Business Account Info...');
    const accountResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${BUSINESS_ACCOUNT_ID}`,
      {
        params: {
          access_token: trimmedToken,
          fields: 'id,name,timezone_id',
        },
      }
    );
    console.log('✅ Success! Account Name:', accountResponse.data.name);
    console.log('   Account ID:', accountResponse.data.id);
    console.log('\n');

    // Test 2: Get Message Templates
    console.log('Test 2: Fetching Message Templates...');
    const templatesResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${BUSINESS_ACCOUNT_ID}/message_templates`,
      {
        params: {
          access_token: trimmedToken,
          limit: 5,
        },
      }
    );
    console.log('✅ Success! Found', templatesResponse.data.data?.length || 0, 'templates');
    if (templatesResponse.data.data && templatesResponse.data.data.length > 0) {
      templatesResponse.data.data.forEach((template, index) => {
        console.log(`   ${index + 1}. ${template.name} (${template.status})`);
      });
    }
    console.log('\n');

    // Test 3: Check Token Scopes
    console.log('Test 3: Checking Token Permissions...');
    const debugResponse = await axios.get(
      'https://graph.facebook.com/v18.0/debug_token',
      {
        params: {
          input_token: trimmedToken,
          access_token: trimmedToken,
        },
      }
    );
    const tokenData = debugResponse.data.data;
    console.log('✅ Token is valid!');
    console.log('   App ID:', tokenData.app_id);
    console.log('   Expires:', tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toLocaleString() : 'Never');
    console.log('   Scopes:', tokenData.scopes?.join(', '));
    console.log('\n');

    console.log('🎉 All tests passed! Your credentials are working correctly.\n');
    console.log('If your backend is still failing, the issue might be:');
    console.log('1. The credentials in the database have extra whitespace');
    console.log('2. The credentials in the database are different from the ones you tested');
    console.log('3. The token has expired since you saved it\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.log('\n');

    if (error.response?.data?.error?.code === 190) {
      console.log('This is an OAuth error (Invalid token). Possible reasons:');
      console.log('1. Token has expired');
      console.log('2. Token was generated for a different app');
      console.log('3. Token has been revoked');
      console.log('4. Token has extra whitespace or special characters\n');
      console.log('Solution: Generate a new access token from Facebook Developer Portal\n');
    }
  }
}

checkCredentials();
