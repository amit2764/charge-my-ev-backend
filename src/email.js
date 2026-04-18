const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');

dotenv.config();

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@ev-charging.local';

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`✉️ [MOCK EMAIL] To: ${to} | Subject: ${subject}`);
    return { success: true, mocked: true };
  }

  try {
    const msg = {
      to,
      from: FROM_EMAIL,
      subject,
      text,
      html: html || text,
    };
    await sgMail.send(msg);
    console.log(`✉️ Email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error.response ? error.response.body : error);
    return { success: false, error: error.message };
  }
}

async function sendReceiptEmail(toEmail, bookingDetails) {
  const { id, finalAmount, durationMinutes } = bookingDetails;
  
  return sendEmail({
    to: toEmail,
    subject: `Your EV Charging Receipt - Booking ${id.slice(-6)}`,
    text: `Thank you for charging with us.\n\nDuration: ${durationMinutes?.toFixed(1)} mins\nTotal Cost: $${finalAmount}\n\nHave a great trip!`,
    html: `<h3>Charging Receipt</h3><p>Thank you for charging with us!</p><ul><li><b>Booking ID:</b> ${id}</li><li><b>Duration:</b> ${durationMinutes?.toFixed(1)} mins</li><li><b>Total Cost:</b> $${finalAmount}</li></ul><p>Have a great trip!</p>`
  });
}

module.exports = {
  sendEmail,
  sendReceiptEmail
};