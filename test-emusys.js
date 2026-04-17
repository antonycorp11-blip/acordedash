const EMUSYS_API_URL = 'https://api.emusys.com.br/v1';
const API_TOKEN = '4vb5JK9QS6YkhaA6JpIIxocrV3VuqU';

async function test() {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] + ' 00:00:00';
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 2, 0).toISOString().split('T')[0] + ' 23:59:59';
    console.log(`Fetching from ${firstDay} to ${lastDay}`);
    
    let allItems = [];
    let hasMore = true;
    let nextCursor = null;

    while (hasMore) {
        let url = `${EMUSYS_API_URL}/aulas?token=${API_TOKEN}&data_hora_inicial=${encodeURIComponent(firstDay)}&data_hora_final=${encodeURIComponent(lastDay)}`;
        if (nextCursor) {
            url += `&cursor=${encodeURIComponent(nextCursor)}`;
        }
        
        console.log("Fetching: " + url.split('?')[1].substring(0, 50) + "...");
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            console.log(`Error: ${response.status}`);
            return;
        }
        const data = await response.json();
        const items = data.items || [];
        allItems = [...allItems, ...items];

        nextCursor = data.paginacao?.proximo_cursor || null;
        hasMore = !!(data.paginacao?.tem_mais && nextCursor);

        if (allItems.length > 5000) break;
    }

    console.log(`Total classes loaded: ${allItems.length}`);
    const aprilClasses = allItems.filter(i => i.data_hora_inicio.startsWith('2026-04'));
    console.log(`Classes in April: ${aprilClasses.length}`);
}
test();
