async function run() {
    try {
        const res = await fetch('http://127.0.0.1:3000/api/general-info', {
            headers: {
                'Cookie': 'vero_session={"id":"hotel-admin-id","email":"hotel@vero.ai"}'
            }
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Text:", text.substring(0, 500));
    } catch (e) {
        console.error(e);
    }
}
run();
