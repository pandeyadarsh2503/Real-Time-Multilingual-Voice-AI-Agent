import React, { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../../firebase';

const countries = [
  { code: '+1', flag: '🇺🇸', name: 'US / Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand' },
];

export default function ProfileView({ user }) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [countryCode, setCountryCode] = useState(localStorage.getItem('patientCountryCode') || '+91');
  const [phoneDigits, setPhoneDigits] = useState(localStorage.getItem('patientPhoneDigits') || '98765 43210');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName });
      localStorage.setItem('patientCountryCode', countryCode);
      localStorage.setItem('patientPhoneDigits', phoneDigits);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    }
    setSaving(false);
  };
  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>Patient Profile</h1>
          <p>Personalized memory and health preferences</p>
        </div>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:'20px', marginTop:'20px'}}>
        
        {/* User Info */}
        <div className="dashboard-card" style={{display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
           <div style={{width:'100px', height:'100px', borderRadius:'50%', background:'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'3rem', color:'#94a3b8', marginBottom:'15px'}}>
              {(displayName || user?.displayName || 'G')[0]}
           </div>
           
           {isEditing ? (
             <div style={{ width: '100%', marginBottom: '15px' }}>
               <input 
                 type="text" 
                 value={displayName} 
                 onChange={(e) => setDisplayName(e.target.value)} 
                 placeholder="Full Name"
                 style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', marginBottom: '10px' }}
               />
               <input 
                 type="email" 
                 value={user?.email || 'No email provided'} 
                 disabled
                 title="Email cannot be changed here"
                 style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', textAlign: 'center', marginBottom: '10px', cursor: 'not-allowed' }}
               />
               <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                 <select 
                   value={countryCode} 
                   onChange={(e) => setCountryCode(e.target.value)}
                   style={{ width: '35%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                 >
                   {countries.map(c => (
                     <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                   ))}
                 </select>
                 <input 
                   type="tel" 
                   value={phoneDigits} 
                   onChange={(e) => setPhoneDigits(e.target.value)} 
                   placeholder="Phone Number"
                   style={{ width: '65%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                 />
               </div>
               <button onClick={handleSave} disabled={saving} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'none', background:'#3b82f6', color:'white', fontWeight:'bold', cursor:'pointer'}}>
                 {saving ? 'Saving...' : 'Save Profile'}
               </button>
               <button onClick={() => setIsEditing(false)} disabled={saving} style={{width:'100%', padding:'10px', marginTop:'10px', borderRadius:'8px', border:'1px solid #cbd5e1', background:'white', cursor:'pointer'}}>
                 Cancel
               </button>
             </div>
           ) : (
             <>
               <h2 style={{margin:0}}>{user?.displayName || 'Guest User'}</h2>
               <div style={{color:'#64748b', marginTop:'5px'}}>{user?.email}</div>
               <div style={{color:'#64748b', marginTop:'2px'}}>{countryCode} {phoneDigits}</div>
               
               <div style={{width:'100%', borderTop:'1px solid #f1f5f9', marginTop:'20px', paddingTop:'20px', textAlign:'left'}}>
                  <h4>Preferences</h4>
                  <div style={{display:'flex', justifyContent:'space-between', marginTop:'10px', fontSize:'0.9rem'}}>
                    <span style={{color:'#64748b'}}>Language</span>
                    <strong>English</strong>
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between', marginTop:'10px', fontSize:'0.9rem'}}>
                    <span style={{color:'#64748b'}}>Updates via</span>
                    <strong>WhatsApp & Voice</strong>
                  </div>
               </div>

               <button onClick={() => setIsEditing(true)} style={{width:'100%', padding:'10px', marginTop:'20px', borderRadius:'8px', border:'1px solid #cbd5e1', background:'white', cursor:'pointer'}}>Edit Profile</button>
             </>
           )}
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
           {/* AI Memory (Very Impressive Feature) */}
           <div className="dashboard-card" style={{border:'2px solid #8b5cf6', background:'#f5f3ff'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                 <h3 style={{color:'#6d28d9', display:'flex', alignItems:'center', gap:'10px'}}>🧠 AI Memory Engine</h3>
                 <span style={{background:'#c4b5fd', color:'#4c1d95', padding:'4px 8px', borderRadius:'12px', fontSize:'0.75rem', fontWeight:'bold'}}>Active</span>
              </div>
              <p style={{fontSize:'0.9rem', color:'#5b21b6', marginTop:'10px'}}>The assistant has learned the following context from your past interactions, enabling faster and smarter booking experiences.</p>
              
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginTop:'20px'}}>
                 <div style={{background:'white', padding:'15px', borderRadius:'8px', border:'1px solid #ddd6fe'}}>
                    <div style={{fontSize:'0.8rem', color:'#6b7280', textTransform:'uppercase'}}>Preferred Doctor</div>
                    <div style={{fontWeight:'bold', fontSize:'1.1rem', marginTop:'5px', color:'#4c1d95'}}>Dr Iyer</div>
                    <div style={{fontSize:'0.85rem', color:'#6d28d9', marginTop:'5px'}}>Usually seen for General Checkups</div>
                 </div>
                 <div style={{background:'white', padding:'15px', borderRadius:'8px', border:'1px solid #ddd6fe'}}>
                    <div style={{fontSize:'0.8rem', color:'#6b7280', textTransform:'uppercase'}}>Optimal Booking Time</div>
                    <div style={{fontWeight:'bold', fontSize:'1.1rem', marginTop:'5px', color:'#4c1d95'}}>Mornings (10am - 12pm)</div>
                    <div style={{fontSize:'0.85rem', color:'#6d28d9', marginTop:'5px'}}>90% of past appointments</div>
                 </div>
              </div>
           </div>

           <div className="dashboard-card">
              <h3>Health Tags (Optional)</h3>
              <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                 <span style={{background:'#fef2f2', color:'#b91c1c', padding:'8px 12px', borderRadius:'20px', fontSize:'0.85rem'}}>Blood Pressure Monitor</span>
                 <span style={{background:'#f0fdf4', color:'#15803d', padding:'8px 12px', borderRadius:'20px', fontSize:'0.85rem'}}>General Checkups</span>
                 <button style={{background:'white', border:'1px dashed #cbd5e1', padding:'8px 12px', borderRadius:'20px', fontSize:'0.85rem', cursor:'pointer'}}>+ Add Tag</button>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
