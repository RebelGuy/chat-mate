% xp function up to 50
scale = 1 / 20;
a = 6000 * scale;
b = 10000 * scale;
E1 = @(x) a*x.^2 + b*x;

% xp function after 50
e = @(c) 100*a + b - 7500*c;
f = @(c) 250000*c - 2500*a;
E2 = @(x, c) c*x.^3 + e(c)*x + f(c); % set quadratic term to 0

% the final function is smooth for any value of c
c = 10;
fplot(@(x) (x < 50)*E1(x) + (x >= 50)*E2(x, c), [0, 100])