/**
 * Standardised Clinicify Email Templates
 */

export function formatTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });
}

const baseStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #f8fafc;
    margin: 0;
    padding: 0;
    color: #0f172a;
    line-height: 1.5;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    margin-top: 20px;
    margin-bottom: 20px;
  }
  .header {
    background-color: #0f172a;
    color: #ffffff;
    padding: 24px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .content {
    padding: 32px 24px;
  }
  .section {
    background-color: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 24px;
    text-align: center;
  }
  .section-title {
    font-size: 12px;
    text-transform: uppercase;
    font-weight: 700;
    color: #0369a1;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  .section-value {
    font-size: 24px;
    font-weight: 800;
    color: #0c4a6e;
    margin: 0;
  }
  .section-value-large {
    font-size: 32px;
    font-weight: 800;
    color: #0c4a6e;
    margin: 0;
  }
  .section-text {
    font-size: 16px;
    font-weight: 600;
    color: #0c4a6e;
    margin: 4px 0 0 0;
  }
  .note {
    font-size: 13px;
    color: #64748b;
    margin-top: 8px;
  }
  .button-container {
    text-align: center;
    margin-top: 32px;
    margin-bottom: 24px;
  }
  .button {
    display: inline-block;
    background-color: #2563eb;
    color: #ffffff !important;
    font-weight: 600;
    font-size: 16px;
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 6px;
  }
  .tracking-link {
    font-size: 12px;
    color: #3b82f6;
    word-break: break-all;
    text-align: center;
    display: block;
  }
  .footer {
    padding: 24px;
    text-align: center;
    font-size: 14px;
    color: #64748b;
    background-color: #f8fafc;
    border-top: 1px solid #e2e8f0;
  }
  .divider {
    height: 1px;
    background-color: #e2e8f0;
    margin: 24px 0;
  }
`;

function wrapEmail(content: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${baseStyles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>CLINICIFY</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p style="margin: 0;"><strong>Clinicify</strong><br/>Know when your turn is coming.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

type VisitEmailProps = {
  token: string;
  doctorName: string;
  department: string;
  room?: string;
  etaLower: number;
  etaUpper: number;
  recommendedArrival: number;
  patientsAhead?: number;
  trackingUrl: string;
};

export function buildVisitConfirmationEmail(props: VisitEmailProps) {
  const timeRange = `${formatTime(props.etaLower)} – ${formatTime(props.etaUpper)}`;
  const doctorInfo = [props.doctorName, props.department, props.room].filter(Boolean).join('<br/>');

  return wrapEmail(`
    <p style="font-size: 16px; text-align: center; margin-bottom: 24px;">Your OPD visit has been registered successfully.</p>
    
    <div class="section">
      <div class="section-title">Your Token</div>
      <p class="section-value-large">${props.token}</p>
    </div>

    <div class="section">
      <div class="section-title">Expected Consultation</div>
      <p class="section-value">${timeRange}</p>
      <div class="note">This is an estimated consultation window and may change as the OPD queue progresses.</div>
    </div>

    <div class="section">
      <div class="section-title">Recommended Arrival</div>
      <p class="section-value">${formatTime(props.recommendedArrival)}</p>
      <div class="note">Please try to reach the OPD by this time.</div>
    </div>

    ${props.patientsAhead !== undefined ? `
    <div class="section">
      <div class="section-title">Patients Ahead</div>
      <p class="section-value">${props.patientsAhead}</p>
    </div>
    ` : ''}

    <div class="section" style="background-color: #f8fafc; border-color: #e2e8f0;">
      <div class="section-title" style="color: #475569;">Doctor</div>
      <p class="section-text" style="color: #334155;">${doctorInfo}</p>
    </div>

    <div class="divider"></div>

    <h3 style="text-align: center; font-size: 16px; margin-bottom: 8px;">Live Queue Tracking</h3>
    <p style="font-size: 14px; color: #475569; text-align: center; margin-top: 0;">
      Your queue position and expected consultation time may change if consultations finish earlier or later, 
      a patient does not arrive, the doctor pauses, or an authorized priority case enters the queue.
    </p>

    <div class="button-container">
      <a href="${props.trackingUrl}" class="button">Track My Queue Live</a>
    </div>
    
    <p style="text-align: center; font-size: 12px; color: #64748b; margin-bottom: 4px;">Tracking URL:</p>
    <a href="${props.trackingUrl}" class="tracking-link">${props.trackingUrl}</a>
  `);
}

export function buildQueueUpdateEmail(props: {
  token: string;
  doctorName: string;
  previousEtaLower: number;
  previousEtaUpper?: number | null;
  newEtaLower: number;
  newEtaUpper: number;
  recommendedArrival: number;
  trackingUrl: string;
}) {
  const prevTimeRange = props.previousEtaUpper 
    ? `${formatTime(props.previousEtaLower)} – ${formatTime(props.previousEtaUpper)}`
    : formatTime(props.previousEtaLower);
  
  const newTimeRange = `${formatTime(props.newEtaLower)} – ${formatTime(props.newEtaUpper)}`;

  return wrapEmail(`
    <p style="font-size: 16px; text-align: center; margin-bottom: 24px;">Your expected consultation time has changed.</p>
    
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="background-color: #e2e8f0; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 14px; letter-spacing: 0.05em;">TOKEN ${props.token}</span>
    </div>

    <div class="section">
      <div class="section-title">Updated Expected Consultation</div>
      <p class="section-value">${newTimeRange}</p>
    </div>

    <div class="section">
      <div class="section-title">Updated Recommended Arrival</div>
      <p class="section-value">${formatTime(props.recommendedArrival)}</p>
    </div>

    <div class="section" style="background-color: #fff1f2; border-color: #fecdd3;">
      <div class="section-title" style="color: #be123c;">Reason</div>
      <p class="section-text" style="color: #9f1239;">A priority case affected your doctor's queue.</p>
    </div>

    <div class="section" style="background-color: #f8fafc; border-color: #e2e8f0;">
      <div class="section-title" style="color: #475569;">Previous Expected Consultation</div>
      <p class="section-text" style="color: #64748b; text-decoration: line-through;">${prevTimeRange}</p>
    </div>

    <div class="divider"></div>

    <div class="button-container">
      <a href="${props.trackingUrl}" class="button">Track My Queue Live</a>
    </div>
    
    <p style="text-align: center; font-size: 12px; color: #64748b; margin-bottom: 4px;">Tracking URL:</p>
    <a href="${props.trackingUrl}" class="tracking-link">${props.trackingUrl}</a>
  `);
}

export function buildPharmacyReadyEmail(props: {
  trackingUrl: string;
}) {
  return wrapEmail(`
    <div style="text-align: center; margin-bottom: 24px; font-size: 48px;">💊</div>
    <p style="font-size: 18px; font-weight: 600; text-align: center; margin-bottom: 24px;">Your pharmacy order is ready for collection.</p>
    
    <div class="button-container">
      <a href="${props.trackingUrl}" class="button">View Order Details</a>
    </div>
  `);
}

export function buildPrescriptionAvailableEmail(props: {
  trackingUrl: string;
}) {
  return wrapEmail(`
    <div style="text-align: center; margin-bottom: 24px; font-size: 48px;">📄</div>
    <p style="font-size: 18px; font-weight: 600; text-align: center; margin-bottom: 24px;">Your prescription is ready for pharmacy fulfillment.</p>
    
    <div class="button-container">
      <a href="${props.trackingUrl}" class="button">View Prescription</a>
    </div>
  `);
}
