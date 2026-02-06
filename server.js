const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CONFIGURATION ───────────────────────────────────────────────
// Set your Resend API key as an environment variable:
//   export RESEND_API_KEY=re_yourKeyHere
//
// Set your verified "From" domain/email in Resend dashboard first.
// ──────────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY || 're_H7XhdSnZ_8bKmw8ApEqVsT1WLx18RbtsZ');

const RECIPIENTS = [
  'rafael@jrcopier.com',
  'jeffp@landscapesunlimitedmn.com',
  'pmurphy@landscapesunlimitedmn.com',
  'monica@landscapesunlimitedmn.com',
  'casey@landscapesunlimitedmn.com',
  'info@landscapesunlimitedmn.com',
  'design@mmcreate.com',
];

// Update this to your verified sender in Resend
const FROM_EMAIL = 'Landscapes Unlimited <noreply@webleadsnow.com>';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Build a nicely formatted HTML email ─────────────────────────
function buildEmailHtml(formData) {
  const services = [];
  if (formData.services) {
    const svcArray = Array.isArray(formData.services)
      ? formData.services
      : [formData.services];
    svcArray.forEach((s) => services.push(s));
  }

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

  const referralLabels = {
    referral: 'Referral',
    search: 'Search Engine',
    social: 'Social Media',
    ad: 'Advertisement',
    other: 'Other',
  };

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
      <!-- Contact Info -->
      <h2 style="color:#1c4e18;font-size:16px;border-bottom:2px solid #31761f;padding-bottom:6px;margin-bottom:12px;">Contact Information</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${row('Name', `${formData.firstName || ''} ${formData.lastName || ''}`)}
        ${row('Email', formData.email)}
        ${row('Phone', formData.phone)}
        ${row('Address', [formData.address, formData.city, formData.state, formData.zipCode].filter(Boolean).join(', '))}
        ${row('Referral Source', referralLabels[formData.referralSource] || formData.referralSource || '—')}
      </table>

      <!-- Project Info -->
      <h2 style="color:#1c4e18;font-size:16px;border-bottom:2px solid #31761f;padding-bottom:6px;margin-bottom:12px;">Project Details</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${row('Project Type', projectTypes[formData.projectType] || formData.projectType || '—')}
        ${row('Description', formData.projectDescription)}
        ${row('Yard Size', formData.yardSize ? `${Number(formData.yardSize).toLocaleString()} sq ft` : '—')}
        ${row('Timeline', formData.timeline || '—')}
        ${row('Budget', formData.budget ? `$${Number(formData.budget).toLocaleString()}` : '—')}
        ${row('Financing Interest', formData.financingInfo === 'yes' ? '✅ Yes' : 'No')}
      </table>

      <!-- Services -->
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

    const htmlContent = buildEmailHtml(formData);
    const clientName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: RECIPIENTS,
      subject: `New Client Form: ${clientName || 'Unknown'} — ${formData.zipCode || 'No ZIP'}`,
      html: htmlContent,
      // Optional: send a confirmation copy to the client
      ...(formData.email && {
        replyTo: formData.email,
      }),
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send email', details: error });
    }

    console.log('Email sent successfully:', data);
    return res.json({ success: true, messageId: data.id });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure RESEND_API_KEY is set in your environment.');
});
