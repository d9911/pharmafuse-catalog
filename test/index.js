for (let i = 1; i <= 1000; i++) {
	let num = i;
	let sum = 0;
	while (num > 0) {
		sum += num % 10;
		num = Math.floor(num / 10);
	}
	if (sum < 10) {
		console.log(i);
	}
}
