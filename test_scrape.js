async function run() {
    try {
        const payload = {
            url: 'https://maps.app.goo.gl/13f5R3bpQjfBdaKz8'
        };
        const res = await fetch('http://127.0.0.1:3000/api/scrape-maps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log("Status:", res.status);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
