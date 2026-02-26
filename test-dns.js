import dns from 'dns';

dns.resolve4('db.zmpltotjlnfkllpliclm.supabase.co', (err, addresses) => {
  console.log('IPv4 addresses: %j', addresses);
  if (err) console.error('IPv4 Error:', err);
});

dns.resolve6('db.zmpltotjlnfkllpliclm.supabase.co', (err, addresses) => {
  console.log('IPv6 addresses: %j', addresses);
  if (err) console.error('IPv6 Error:', err);
});
