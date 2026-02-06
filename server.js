const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CONFIGURATION ───────────────────────────────────────────────
// All secrets are set as environment variables in Railway
const resend = new Resend(process.env.RESEND_API_KEY);

// Airtable config
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

const RECIPIENTS = [
  'rafael@jrcopier.com',
  'jeffp@landscapesunlimitedmn.com',
  'pmurphy@landscapesunlimitedmn.com',
  'monica@landscapesunlimitedmn.com',
  'casey@landscapesunlimitedmn.com',
  'info@landscapesunlimitedmn.com',
  'design@mmcreate.com',
];

const FROM_EMAIL = 'Landscapes Unlimited <noreply@webleadsnow.com>';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Label mappings ──────────────────────────────────────────────
const serviceLabels = {
  landscape: 'Landscape Design',
  irrigation: 'Irrigation Repair & Service',
  maintenance: 'Commercial Maintenance',
  mowing: 'Lawn Care & Mowing',
  fertilization: 'Fertilization & Weed Control',
  cleanup: 'Yard Cleanup',
  lighting: 'Low Volt Lighting',
  snow: 'Commercial Snow Removal',
};

const projectTypes = {
  new: 'New Landscape',
  renovation: 'Landscape Renovation',
  maintenance: 'Ongoing Maintenance',
  seasonal: 'Seasonal Service',
  other: 'Other',
};

const timelineLabels = {
  immediate: 'Immediate (0-1 month)',
  soon: 'Soon (1-3 months)',
  future: 'Future (3-6 months)',
  planning: 'Just Planning (6+ months)',
};

const referralLabels = {
  referral: 'Referral',
  search: 'Search Engine',
  social: 'Social Media',
  ad: 'Advertisement',
  other: 'Other',
};

// ─── Send to Airtable ────────────────────────────────────────────
async function sendToAirtable(formData) {
  const services = [];
  if (formData.services) {
    const svcArray = Array.isArray(formData.services) ? formData.services : [formData.services];
    svcArray.forEach((s) => services.push(serviceLabels[s] || s));
  }

  const fields = {
    'Name': `${formData.firstName || ''} ${formData.lastName || ''}`.trim(),
    'Email': formData.email || '',
    'Phone': formData.phone || '',
    'ZIP Code': formData.zipCode || '',
    'Address': [formData.address, formData.city, formData.state].filter(Boolean).join(', '),
    'Project Type': projectTypes[formData.projectType] || formData.projectType || '',
    'Project Description': formData.projectDescription || '',
    'Yard Size': formData.yardSize ? `${Number(formData.yardSize).toLocaleString()} sq ft` : '',
    'Timeline': timelineLabels[formData.timeline] || formData.timeline || '',
    'Budget': formData.budget || '',
    'Services': services.join(', '),
    'Financing Interest': formData.financingInfo === 'yes' ? 'Yes' : 'No',
    'Referral Source': referralLabels[formData.referralSource] || formData.referralSource || '',
    'Additional Comments': formData.additionalComments || '',
    'Submitted At': new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
  };

  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Airtable error: ${response.status} — ${errBody}`);
  }

  return await response.json();
}

// ─── Build HTML email ────────────────────────────────────────────
function buildEmailHtml(formData) {
  const services = [];
  if (formData.services) {
    const svcArray = Array.isArray(formData.services) ? formData.services : [formData.services];
    svcArray.forEach((s) => services.push(s));
  }

  const row = (label, value) =>
    value
      ? `<tr>
           <td style="padding:8px 12px;font-weight:600;color:#1c4e18;width:40%;border-bottom:1px solid #e2e8f0;">${label}</td>
           <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${value}</td>
         </tr>`
      : '';

  return `
  <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1c4e18,#31761f);padding:24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">New Client Form Submission</h1>
      <p style="color:#d4edda;margin:8px 0 0;">Landscapes Unlimited</p>
    </div>

    <div style="padding:24px;">
      <h2 style="color:#1c4e18;font-size:16px;border-bottom:2px solid #31761f;padding-bottom:6px;margin-bottom:12px;">Contact Information</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${row('Name', `${formData.firstName || ''} ${formData.lastName || ''}`)}
        ${row('Email', formData.email)}
        ${row('Phone', formData.phone)}
        ${row('Address', [formData.address, formData.city, formData.state, formData.zipCode].filter(Boolean).join(', '))}
        ${row('Referral Source', referralLabels[formData.referralSource] || formData.referralSource || '—')}
      </table>

      <h2 style="color:#1c4e18;font-size:16px;border-bottom:2px solid #31761f;padding-bottom:6px;margin-bottom:12px;">Project Details</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${row('Project Type', projectTypes[formData.projectType] || formData.projectType || '—')}
        ${row('Description', formData.projectDescription)}
        ${row('Yard Size', formData.yardSize ? `${Number(formData.yardSize).toLocaleString()} sq ft` : '—')}
        ${row('Timeline', timelineLabels[formData.timeline] || formData.timeline || '—')}
        ${row('Budget', formData.budget ? `$${Number(formData.budget).toLocaleString()}` : '—')}
        ${row('Financing Interest', formData.financingInfo === 'yes' ? '✅ Yes' : 'No')}
      </table>

      <h2 style="color:#1c4e18;font-size:16px;border-bottom:2px solid #31761f;padding-bottom:6px;margin-bottom:12px;">Services Requested</h2>
      ${
        services.length > 0
          ? `<ul style="padding-left:20px;margin-bottom:24px;">${services.map((s) => `<li style="margin-bottom:4px;">${serviceLabels[s] || s}</li>`).join('')}</ul>`
          : '<p style="color:#718096;margin-bottom:24px;">None selected</p>'
      }

      ${formData.additionalComments ? `<h2 style="color:#1c4e18;font-size:16px;border-bottom:2px solid #31761f;padding-bottom:6px;margin-bottom:12px;">Additional Comments</h2><p style="background:#f7fafc;padding:12px;border-radius:6px;border-left:4px solid #31761f;margin-bottom:24px;">${formData.additionalComments}</p>` : ''}
    </div>

    <div style="background:#f7fafc;padding:16px;text-align:center;font-size:12px;color:#718096;">
      Submitted on ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT
    </div>
  </div>`;
}

// ─── API Endpoint ────────────────────────────────────────────────
app.post('/api/send-form', async (req, res) => {
  try {
    const { formData } = req.body;

    if (!formData) {
      return res.status(400).json({ error: 'Missing form data' });
    }

    // Send email and log to Airtable in parallel
    const [emailResult, airtableResult] = await Promise.allSettled([
      resend.emails.send({
        from: FROM_EMAIL,
        to: RECIPIENTS,
        subject: `New Client Form: ${`${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'Unknown'} — ${formData.zipCode || 'No ZIP'}`,
        html: buildEmailHtml(formData),
        ...(formData.email && { replyTo: formData.email }),
      }),
      sendToAirtable(formData),
    ]);

    // Log results
    if (emailResult.status === 'fulfilled') {
      if (emailResult.value.error) {
        console.error('Resend error:', emailResult.value.error);
      } else {
        console.log('Email sent:', emailResult.value.data?.id);
      }
    } else {
      console.error('Email failed:', emailResult.reason);
    }

    if (airtableResult.status === 'fulfilled') {
      console.log('Airtable record created:', airtableResult.value?.records?.[0]?.id);
    } else {
      console.error('Airtable failed:', airtableResult.reason);
    }

    // Respond success if at least one worked
    const emailOk = emailResult.status === 'fulfilled' && !emailResult.value.error;
    const airtableOk = airtableResult.status === 'fulfilled';

    if (emailOk || airtableOk) {
      return res.json({ success: true, email: emailOk, airtable: airtableOk });
    } else {
      return res.status(500).json({ error: 'Both email and Airtable failed' });
    }
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
