const emailValidator = require('email-validator');
const dns = require('dns');
const nodemailer = require('nodemailer');

export default async function handler(req, res) {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const isValid = emailValidator.validate(email);

  if (!isValid) {
    return res.status(200).json({ status: 'invalid' });
  }

  // Extract domain from email
  const domain = email.split('@')[1];

  try {
    // DNS check
    await dns.promises.resolve(domain);

    // MX records check
    const mxRecords = await dns.promises.resolveMx(domain);
    const mxValid = mxRecords && mxRecords.length > 0;

    if (!mxValid) {
      return res.status(200).json({ status: 'invalid' });
    }

    // SMTP check
    const smtpValid = await checkSMTP(mxRecords, email);

    if (smtpValid) {
      return res.status(200).json({ status: 'valid' });
    } else {
      return res.status(200).json({ status: 'invalid' });
    }
  } catch (error) {
    return res.status(200).json({ status: 'invalid' });
  }
}

async function checkSMTP(mxRecords, email) {
  if (!mxRecords || mxRecords.length === 0) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: mxRecords[0].exchange,
    port: 25,
    secure: false,
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    await transporter.verify();

    // Perform RCPT TO check with a universal sender email
    const result = await new Promise((resolve) => {
      transporter.sendMail({
        from: 'noreply@example.com',
        to: email,
      }, (error, info) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    return result;
  } catch (error) {
    return false;
  }
}
