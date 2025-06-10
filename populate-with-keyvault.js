// Populate Azure SQL with TBWA Campaign Intelligence Data using Key Vault credentials
require('dotenv').config({path: '.env.local'});
const sql = require('mssql');
const { getKeyVaultCredentials } = require('./get-keyvault-credentials');

async function populateWithKeyVault() {
  console.log('🚀 TBWA Creative Intelligence → Azure SQL (Key Vault Auth)');
  console.log('========================================================');
  
  let pool;
  
  try {
    // Get credentials from Key Vault
    const credentials = await getKeyVaultCredentials();
    
    // Create SQL configuration
    const config = {
      server: credentials.server,
      database: credentials.database,
      user: credentials.user,
      password: credentials.password,
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    };
    
    // Connect to Azure SQL
    console.log('📡 Connecting to Azure SQL with Key Vault credentials...');
    pool = await sql.connect(config);
    console.log('✅ Connected successfully');
    
    // Check existing tables
    const tables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log('📋 Existing tables found:');
    tables.recordset.forEach(table => {
      console.log(`   • ${table.TABLE_NAME}`);
    });
    
    // Find a suitable table to add TBWA data
    const tableNames = tables.recordset.map(t => t.TABLE_NAME);
    
    if (tableNames.includes('SalesInteractions')) {
      await populateSalesInteractions(pool);
    } else if (tableNames.includes('transactions')) {
      await populateTransactions(pool);
    } else {
      await createTBWATable(pool);
    }
    
    console.log('');
    console.log('🎉 TBWA Campaign Data Added Successfully!');
    console.log('✅ Ready to use in your dashboard');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('Login failed')) {
      console.log('');
      console.log('💡 Database connection issue even with Key Vault credentials.');
      console.log('   The server might be using different authentication or be unreachable.');
    }
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

async function populateSalesInteractions(pool) {
  console.log('📊 Adding TBWA campaign data to SalesInteractions table...');
  
  const campaigns = [
    {
      StoreID: 'TBWA_001',
      DeviceID: 'TBWA_CAMPAIGN_001', 
      FacialID: 'Q4_HOLIDAY',
      Age: 35,
      Gender: 'Campaign',
      EmotionalState: 'Positive',
      InteractionDate: new Date(),
      campaign_name: 'Q4 Holiday Campaign 2024',
      predicted_roi: 2.8,
      predicted_ctr: 3.2
    },
    {
      StoreID: 'TBWA_002',
      DeviceID: 'TBWA_CAMPAIGN_002',
      FacialID: 'BRAND_AWARENESS', 
      Age: 28,
      Gender: 'Campaign',
      EmotionalState: 'Neutral',
      InteractionDate: new Date(),
      campaign_name: 'Brand Awareness Campaign',
      predicted_roi: 1.9,
      predicted_ctr: 1.8
    },
    {
      StoreID: 'TBWA_003',
      DeviceID: 'TBWA_CAMPAIGN_003',
      FacialID: 'PRODUCT_LAUNCH',
      Age: 42,
      Gender: 'Campaign', 
      EmotionalState: 'Positive',
      InteractionDate: new Date(),
      campaign_name: 'New Product Launch',
      predicted_roi: 3.5,
      predicted_ctr: 4.1
    }
  ];
  
  for (const campaign of campaigns) {
    await pool.request()
      .input('StoreID', sql.NVarChar, campaign.StoreID)
      .input('DeviceID', sql.NVarChar, campaign.DeviceID)
      .input('FacialID', sql.NVarChar, campaign.FacialID)
      .input('Age', sql.Int, campaign.Age)
      .input('Gender', sql.NVarChar, campaign.Gender)
      .input('EmotionalState', sql.NVarChar, campaign.EmotionalState)
      .input('InteractionDate', sql.DateTime, campaign.InteractionDate)
      .query(`
        INSERT INTO SalesInteractions (StoreID, DeviceID, FacialID, Age, Gender, EmotionalState, TransactionDate)
        VALUES (@StoreID, @DeviceID, @FacialID, @Age, @Gender, @EmotionalState, @InteractionDate)
      `);
      
    console.log(`   ✅ Added: ${campaign.campaign_name}`);
  }
}

async function populateTransactions(pool) {
  console.log('📊 Adding TBWA campaign data to transactions table...');
  
  const campaigns = [
    { name: 'Q4 Holiday Campaign 2024', amount: 15000, roi: 2.8, ctr: 3.2 },
    { name: 'Brand Awareness Campaign', amount: 8000, roi: 1.9, ctr: 1.8 },
    { name: 'New Product Launch', amount: 22000, roi: 3.5, ctr: 4.1 }
  ];
  
  for (const campaign of campaigns) {
    await pool.request()
      .input('amount', sql.Decimal(10,2), campaign.amount)
      .input('description', sql.NVarChar, `TBWA Campaign: ${campaign.name}`)
      .input('date', sql.DateTime, new Date())
      .query(`
        INSERT INTO transactions (total_amount, description, created_at)
        VALUES (@amount, @description, @date)
      `);
      
    console.log(`   ✅ Added: ${campaign.name} ($${campaign.amount})`);
  }
}

async function createTBWATable(pool) {
  console.log('📋 Creating TBWA campaigns table...');
  
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tbwa_campaigns' AND xtype='U')
    CREATE TABLE tbwa_campaigns (
      id INT IDENTITY(1,1) PRIMARY KEY,
      campaign_name NVARCHAR(255) NOT NULL,
      client_name NVARCHAR(255),
      predicted_roi DECIMAL(4,2),
      predicted_ctr DECIMAL(4,2),
      confidence_score DECIMAL(3,2),
      created_at DATETIME DEFAULT GETDATE()
    )
  `);
  
  const campaigns = [
    { name: 'Q4 Holiday Campaign 2024', client: 'Major Retail Client', roi: 2.8, ctr: 3.2, confidence: 0.87 },
    { name: 'Brand Awareness Campaign', client: 'Tech Startup', roi: 1.9, ctr: 1.8, confidence: 0.72 },
    { name: 'New Product Launch', client: 'Consumer Goods Company', roi: 3.5, ctr: 4.1, confidence: 0.93 }
  ];
  
  for (const campaign of campaigns) {
    await pool.request()
      .input('name', sql.NVarChar, campaign.name)
      .input('client', sql.NVarChar, campaign.client)
      .input('roi', sql.Decimal(4,2), campaign.roi)
      .input('ctr', sql.Decimal(4,2), campaign.ctr)
      .input('confidence', sql.Decimal(3,2), campaign.confidence)
      .query(`
        INSERT INTO tbwa_campaigns (campaign_name, client_name, predicted_roi, predicted_ctr, confidence_score)
        VALUES (@name, @client, @roi, @ctr, @confidence)
      `);
      
    console.log(`   ✅ Added: ${campaign.name}`);
  }
}

// Run the population
populateWithKeyVault();