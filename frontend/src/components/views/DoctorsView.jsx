import React from 'react';

export default function DoctorsView() {
  const doctors = [
    { name: 'Dr Sharma', specialty: 'Cardiologist', rating: '4.9', reviews: 124, status: 'Available', exp: '15 Yrs', img: '👨‍⚕️', tags: ['Frequently visited', 'Recommended'] },
    { name: 'Dr Iyer', specialty: 'General Physician', rating: '4.8', reviews: 342, status: 'Busy', exp: '20 Yrs', img: '👩‍⚕️', tags: ['Family Doctor'] },
    { name: 'Dr Mehta', specialty: 'Dermatologist', rating: '4.7', reviews: 89, status: 'Available', exp: '8 Yrs', img: '👨‍⚕️', tags: ['Skin Care'] },
    { name: 'Dr Reddy', specialty: 'Neurologist', rating: '4.9', reviews: 210, status: 'On Leave', exp: '22 Yrs', img: '👩‍⚕️', tags: ['Top Rated'] },
    { name: 'Dr Gupta', specialty: 'Pediatrician', rating: '4.6', reviews: 156, status: 'Available', exp: '12 Yrs', img: '👨‍⚕️', tags: ['Kids Specialist'] }
  ];

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>Doctor Directory</h1>
          <p>Find, review and book with specialized doctors</p>
        </div>
        <div className="search-bar">
          <input type="text" placeholder="Search by name, specialty..." style={{padding:'10px', borderRadius:'8px', border:'1px solid #cbd5e1', width:'300px'}} />
        </div>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'20px', marginTop:'30px'}}>
        {doctors.map(doc => (
          <div key={doc.name} className="doctor-profile-card dashboard-card" style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div style={{fontSize:'3rem'}}>{doc.img}</div>
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                  <span style={{background: doc.status === 'Available' ? '#dcfce7' : doc.status === 'Busy' ? '#fef3c7' : '#fee2e2', color: doc.status === 'Available' ? '#166534' : doc.status === 'Busy' ? '#92400e' : '#991b1b', padding:'4px 8px', borderRadius:'12px', fontSize:'0.75rem', fontWeight:600}}>{doc.status}</span>
                  <div style={{marginTop:'5px', color:'#f59e0b', fontWeight:600}}>⭐ {doc.rating} <span style={{color:'#94a3b8', fontSize:'0.75rem'}}>({doc.reviews})</span></div>
                </div>
            </div>

            <div>
               <h3 style={{margin:0}}>{doc.name}</h3>
               <div style={{color:'#64748b', fontSize:'0.9rem'}}>{doc.specialty} • {doc.exp} EXP</div>
            </div>

            <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
               {doc.tags.map(tag => (
                 <span key={tag} style={{background:'#f1f5f9', color:'#475569', padding:'4px 8px', borderRadius:'4px', fontSize:'0.7rem', fontWeight:500}}>{tag}</span>
               ))}
            </div>

            <div className="heatmap-mockup" style={{marginTop:'10px'}}>
               <div style={{fontSize:'0.75rem', color:'#64748b', marginBottom:'5px'}}>Availability Heatmap (Next 5 Days)</div>
               <div style={{display:'flex', gap:'4px'}}>
                 {Array.from({length: 5}).map((_, i) => (
                   <div key={i} style={{height:'8px', flex:1, borderRadius:'4px', background: doc.status==='Available' ? (i%2===0 ? '#34d399' : '#10b981') : (doc.status==='Busy' ? '#fcd34d' : '#fca5a5')}}></div>
                 ))}
               </div>
            </div>

            <button style={{
              width:'100%', padding:'10px', borderRadius:'8px', border:'none', 
              background: doc.status === 'On Leave' ? '#f1f5f9' : '#3b82f6', 
              color: doc.status === 'On Leave' ? '#94a3b8' : 'white', 
              fontWeight:600, cursor: doc.status === 'On Leave' ? 'not-allowed' : 'pointer'
            }}>
              {doc.status === 'On Leave' ? 'Unavailable' : 'Book Next Slot'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
