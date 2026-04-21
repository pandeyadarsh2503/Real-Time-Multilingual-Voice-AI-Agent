import React from 'react';

export default function ProfileView({ user }) {
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
              {(user?.displayName || 'G')[0]}
           </div>
           <h2 style={{margin:0}}>{user?.displayName || 'Guest User'}</h2>
           <div style={{color:'#64748b', marginTop:'5px'}}>+91 98765 43210</div>
           
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

           <button style={{width:'100%', padding:'10px', marginTop:'20px', borderRadius:'8px', border:'1px solid #cbd5e1', background:'white'}}>Edit Profile</button>
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
