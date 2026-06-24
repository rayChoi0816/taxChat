#include <stdio.h>

int main() {
	int a = 1, b = 1;

	a++;
	++b;

	printf("a의 값은 %d\n", a);
	printf("b의 값은 %d\n", b);

	a--;
	--b;

	printf("a의 값은 %d\n", a);
	printf("b의 값은 %d\n", b);
}
